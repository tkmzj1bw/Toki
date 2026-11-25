//! The Rust port of `src/hardware/commands.ts` (the pure Marlin safety rules).
//!
//! The stateful/async parts (adapters, WebSerial transport, connection manager) stay in
//! TypeScript: they own timers, listeners and the browser serial API. This crate ports the
//! allowlist and the command validator exactly, including the JS normalization, regex
//! semantics, numeric coercion and error messages.

#![forbid(unsafe_code)]

use serde_json::{Value, json};

// ---- JS value helpers -----------------------------------------------------------------------

fn is_undefined(v: &Value) -> bool {
    crate::js::is_undefined(v)
}

fn get_prop<'a>(v: &'a Value, key: &str) -> Result<Option<&'a Value>, String> {
    if is_undefined(v) {
        return Err(format!(
            "Cannot read properties of undefined (reading '{key}')"
        ));
    }
    match v {
        Value::Null => Err(format!("Cannot read properties of null (reading '{key}')")),
        Value::Object(o) => Ok(o.get(key)),
        _ => Ok(None),
    }
}

fn truthy(v: Option<&Value>) -> bool {
    let Some(v) = v else { return false };
    if let Some(n) = crate::js::as_number(v) {
        return n != 0.0 && !n.is_nan();
    }
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::String(s) => !s.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
        Value::Number(_) => false,
    }
}

fn to_number(v: &Value) -> f64 {
    if let Some(n) = crate::js::as_number(v) {
        return n;
    }
    match v {
        Value::String(s) => {
            let s = s.trim();
            if s.is_empty() {
                0.0
            } else {
                s.parse::<f64>().unwrap_or(f64::NAN)
            }
        }
        Value::Bool(b) => {
            if *b {
                1.0
            } else {
                0.0
            }
        }
        Value::Null => 0.0,
        _ => f64::NAN,
    }
}

fn number_or_nan(v: Option<&Value>) -> f64 {
    v.map(to_number).unwrap_or(f64::NAN)
}

fn read_num(obj: Option<&Value>, key: &str) -> Result<f64, String> {
    Ok(number_or_nan(get_prop(obj.unwrap_or(&Value::Null), key)?))
}

fn js_to_string(v: Option<&Value>) -> String {
    let Some(v) = v else {
        return "undefined".to_string();
    };
    match v {
        Value::String(s) => s.clone(),
        Value::Number(_) => crate::js::number_to_string(to_number(v)),
        Value::Bool(b) => b.to_string(),
        Value::Null => "null".to_string(),
        Value::Array(a) => a
            .iter()
            .map(|x| {
                if matches!(x, Value::Null) || is_undefined(x) {
                    String::new()
                } else {
                    js_to_string(Some(x))
                }
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => {
            if is_undefined(v) {
                "undefined".to_string()
            } else {
                "[object Object]".to_string()
            }
        }
    }
}

fn js_min(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a == 0.0 && b == 0.0 {
        if a.is_sign_negative() || b.is_sign_negative() {
            -0.0
        } else {
            0.0
        }
    } else if a < b {
        a
    } else {
        b
    }
}

fn js_max(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a == 0.0 && b == 0.0 {
        if a.is_sign_positive() || b.is_sign_positive() {
            0.0
        } else {
            -0.0
        }
    } else if a > b {
        a
    } else {
        b
    }
}

/// ECMAScript WhiteSpace + LineTerminator (the `\s` class without the `u` flag).
fn js_space(c: char) -> bool {
    matches!(
        c,
        '\u{0009}'
            | '\u{000B}'
            | '\u{000C}'
            | '\u{0020}'
            | '\u{00A0}'
            | '\u{FEFF}'
            | '\u{000A}'
            | '\u{000D}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200A}' | '\u{202F}' | '\u{205F}' | '\u{3000}'
    )
}

/// JS `String.prototype.trim` (same set as `\s`).
fn js_trim(s: &str) -> &str {
    s.trim_matches(js_space)
}

/// JS `String.prototype.toUpperCase` (Unicode default case conversion, not locale-aware).
fn js_upper(s: &str) -> String {
    s.chars().flat_map(char::to_uppercase).collect()
}

/// `raw.trim().toUpperCase().replace(/\s+/g, ' ')`.
fn normalize(raw: &str) -> String {
    let trimmed = js_trim(raw);
    let upper = js_upper(trimmed);
    let mut out = String::with_capacity(upper.len());
    let mut in_space = false;
    for c in upper.chars() {
        if js_space(c) {
            if !in_space {
                out.push(' ');
            }
            in_space = true;
        } else {
            out.push(c);
            in_space = false;
        }
    }
    out
}

fn is_word_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

/// `/^[GM]\d+(?:\s+[XYZEFS]\s*-?\d+(?:\.\d+)?)*$/i` on the already normalized command.
fn token_ok(command: &str) -> bool {
    let b = command.as_bytes();
    let mut i = 0;
    if i >= b.len() || (b[i] != b'G' && b[i] != b'M') {
        return false;
    }
    i += 1;
    let digits_start = i;
    while i < b.len() && b[i].is_ascii_digit() {
        i += 1;
    }
    if i == digits_start {
        return false;
    }
    while i < b.len() {
        if b[i] != b' ' {
            return false;
        }
        i += 1;
        if i >= b.len() || !matches!(b[i], b'X' | b'Y' | b'Z' | b'E' | b'F' | b'S') {
            return false;
        }
        i += 1;
        if i < b.len() && b[i] == b' ' {
            i += 1;
        }
        if i < b.len() && b[i] == b'-' {
            i += 1;
        }
        let start = i;
        while i < b.len() && b[i].is_ascii_digit() {
            i += 1;
        }
        if i == start {
            return false;
        }
        if i < b.len() && b[i] == b'.' {
            i += 1;
            let frac_start = i;
            while i < b.len() && b[i].is_ascii_digit() {
                i += 1;
            }
            if i == frac_start {
                return false;
            }
        }
    }
    true
}

#[derive(Default, Debug)]
struct Params {
    x: Option<f64>,
    y: Option<f64>,
    z: Option<f64>,
    e: Option<f64>,
    f: Option<f64>,
    s: Option<f64>,
}

impl Params {
    fn set(&mut self, key: u8, value: f64) {
        match key {
            b'X' => self.x = Some(value),
            b'Y' => self.y = Some(value),
            b'Z' => self.z = Some(value),
            b'E' => self.e = Some(value),
            b'F' => self.f = Some(value),
            b'S' => self.s = Some(value),
            _ => {}
        }
    }
}

/// `/\b([XYZEFS])\s*(-?\d+(?:\.\d+)?)/g` over a command that already passed `token_ok`.
fn parse_params(command: &str) -> Params {
    let b = command.as_bytes();
    let mut params = Params::default();
    let mut i = 0;
    while i < b.len() {
        let c = b[i];
        let boundary = i == 0 || !is_word_byte(b[i - 1]);
        if boundary && matches!(c, b'X' | b'Y' | b'Z' | b'E' | b'F' | b'S') {
            let mut j = i + 1;
            while j < b.len() && b[j] == b' ' {
                j += 1;
            }
            let negative = j < b.len() && b[j] == b'-';
            if negative {
                j += 1;
            }
            let start = j;
            while j < b.len() && b[j].is_ascii_digit() {
                j += 1;
            }
            if j > start {
                let mut end = j;
                if end < b.len() && b[end] == b'.' {
                    let frac = end + 1;
                    if frac < b.len() && b[frac].is_ascii_digit() {
                        let mut k = frac;
                        while k < b.len() && b[k].is_ascii_digit() {
                            k += 1;
                        }
                        end = k;
                    }
                }
                if let Ok(n) = command[start..end].parse::<f64>() {
                    params.set(c, if negative { -n } else { n });
                }
                i = end;
                continue;
            }
        }
        i += 1;
    }
    params
}

fn leading_code(command: &str) -> String {
    let b = command.as_bytes();
    let mut i = 0;
    if i < b.len() && (b[i] == b'G' || b[i] == b'M') {
        i += 1;
        while i < b.len() && b[i].is_ascii_digit() {
            i += 1;
        }
    }
    command[..i].to_string()
}

// ---- src/hardware/commands.ts ---------------------------------------------------------------

const COMMON: [&str; 14] = [
    "G0", "G1", "G4", "G21", "G28", "G90", "M17", "M18", "M105", "M114", "M115", "M400", "M410",
    "M112",
];
const THERMAL: [&str; 6] = ["M104", "M109", "M140", "M190", "M106", "M107"];
const SPINDLE: [&str; 3] = ["M3", "M4", "M5"];

fn allowed_commands_for_impl(rig: &Value) -> Result<Vec<String>, String> {
    let mode = get_prop(rig, "mode")?;
    let mode = js_to_string(mode);
    let mut base: Vec<String> = COMMON.iter().map(|s| (*s).to_string()).collect();
    if mode == "printer3d" {
        base.extend(THERMAL.iter().map(|s| (*s).to_string()));
    }
    if mode == "cnc" {
        base.extend(SPINDLE.iter().map(|s| (*s).to_string()));
    }
    base.sort();
    Ok(base)
}

fn ack_value(rig: &Value, key: &str) -> Result<bool, String> {
    let ack = get_prop(rig, "acknowledged")?;
    Ok(truthy(get_prop(ack.unwrap_or(&Value::Null), key)?))
}

fn result(command: &str, reason: Option<String>) -> Value {
    match reason {
        Some(reason) => json!({ "ok": false, "command": command, "reason": reason }),
        None => json!({ "ok": true, "command": command }),
    }
}

fn validate_command_impl(raw: &str, context: &Value) -> Result<Value, String> {
    let command = normalize(raw);
    if command.is_empty() {
        return Ok(result(&command, Some("Comando vazio.".to_string())));
    }
    if !truthy(get_prop(context, "connected")?) {
        return Ok(result(
            &command,
            Some("Sem conexão ativa com a máquina.".to_string()),
        ));
    }
    if command.contains(';') {
        return Ok(result(
            &command,
            Some("Use apenas um comando por linha.".to_string()),
        ));
    }
    if !token_ok(&command) {
        return Ok(result(
            &command,
            Some("Comando fora da lista segura de operação.".to_string()),
        ));
    }

    let code = leading_code(&command);
    let rig = get_prop(context, "rig")?.unwrap_or(&Value::Null);
    let allowed = allowed_commands_for_impl(rig)?;
    if !allowed.iter().any(|c| c == &code) {
        let mode = get_prop(rig, "mode")?;
        let upper = match mode {
            None => {
                return Err(
                    "Cannot read properties of undefined (reading 'toUpperCase')".to_string(),
                );
            }
            Some(v) if is_undefined(v) => {
                return Err(
                    "Cannot read properties of undefined (reading 'toUpperCase')".to_string(),
                );
            }
            Some(Value::Null) => {
                return Err("Cannot read properties of null (reading 'toUpperCase')".to_string());
            }
            Some(Value::String(s)) => js_upper(s),
            Some(v) => {
                return Err(format!(
                    "{}.toUpperCase is not a function",
                    js_to_string(Some(v))
                ));
            }
        };
        return Ok(result(
            &command,
            Some(format!("Comando {code} não permitido no modo {upper}.")),
        ));
    }

    let params = parse_params(&command);
    let is_motion = code == "G0" || code == "G1";
    let uses_s = matches!(
        code.as_str(),
        "M104" | "M109" | "M140" | "M190" | "M106" | "M3" | "M4"
    );
    if params.s.is_some() && !uses_s {
        return Ok(result(
            &command,
            Some(format!("Parâmetro S não é aceito por {code}.")),
        ));
    }
    if params.f.is_some() && !is_motion {
        return Ok(result(
            &command,
            Some("Parâmetro F só é aceito em movimentos G0/G1.".to_string()),
        ));
    }
    if params.e.is_some() && !is_motion {
        return Ok(result(
            &command,
            Some("Parâmetro E só é aceito em movimentos G0/G1.".to_string()),
        ));
    }

    let rig_mode = get_prop(rig, "mode")?;
    let key = match rig_mode {
        None => "undefined".to_string(),
        Some(v) if is_undefined(v) => "undefined".to_string(),
        Some(v) => js_to_string(Some(v)),
    };
    let profiles = get_prop(rig, "profiles")?;
    let profile = get_prop(profiles.unwrap_or(&Value::Null), &key)?;
    let bed = get_prop(profile.unwrap_or(&Value::Null), "bed")?;
    let width_v = get_prop(bed.unwrap_or(&Value::Null), "width")?;
    let height_v = get_prop(bed.unwrap_or(&Value::Null), "height")?;
    let max_z_v = get_prop(bed.unwrap_or(&Value::Null), "maxZ")?;
    let width = number_or_nan(width_v);
    let height = number_or_nan(height_v);
    let max_z = number_or_nan(max_z_v);
    let tool = get_prop(profile.unwrap_or(&Value::Null), "tool")?;

    let mode = rig_mode.map(|v| js_to_string(Some(v))).unwrap_or_default();
    let (z_min, z_max) = if mode == "plotter" || mode == "cnc" {
        let safe = read_num(tool, "safeZ")?;
        let work = read_num(tool, "workZ")?;
        (js_min(safe, work) - 2.0, js_max(safe, work) + 5.0)
    } else {
        (0.0, max_z)
    };
    let z_min_s = crate::js::number_to_string(z_min);
    let z_max_s = crate::js::number_to_string(z_max);

    if let Some(x) = params.x
        && (x < 0.0 || x > width)
    {
        return Ok(result(
            &command,
            Some(format!(
                "X fora do leito da rig (0–{} mm).",
                js_to_string(width_v)
            )),
        ));
    }
    if let Some(y) = params.y
        && (y < 0.0 || y > height)
    {
        return Ok(result(
            &command,
            Some(format!(
                "Y fora do leito da rig (0–{} mm).",
                js_to_string(height_v)
            )),
        ));
    }
    if let Some(z) = params.z
        && (z < z_min || z > z_max)
    {
        return Ok(result(
            &command,
            Some(format!(
                "Z fora da faixa segura da rig ({z_min_s}–{z_max_s} mm)."
            )),
        ));
    }
    if let Some(e) = params.e {
        if mode != "printer3d" {
            return Ok(result(
                &command,
                Some("Extrusão (E) disponível apenas na impressora 3D.".to_string()),
            ));
        }
        if !ack_value(rig, "thermalRunaway")? {
            return Ok(result(
                &command,
                Some(
                    "Extrusão bloqueada: confirme a proteção thermal runaway em RIG / MÁQUINA."
                        .to_string(),
                ),
            ));
        }
        let context_mode = get_prop(context, "mode")?;
        let context_mode = js_to_string(context_mode);
        if context_mode == "hardware" {
            let nozzle = get_prop(context, "nozzleTemp")?;
            let missing = match nozzle {
                None | Some(Value::Null) => true,
                Some(v) if is_undefined(v) => true,
                _ => false,
            };
            if missing || to_number(nozzle.unwrap_or(&Value::Null)) < 180.0 {
                return Ok(result(
                    &command,
                    Some(
                        "Extrusão bloqueada: bico abaixo de 180 °C ou leitura M105 indisponível."
                            .to_string(),
                    ),
                ));
            }
        }
        if e < 0.0 || e > 10000.0 {
            return Ok(result(
                &command,
                Some("Valor de extrusão fora da faixa (0–10000 mm).".to_string()),
            ));
        }
    }
    if let Some(f) = params.f {
        let feed_v = get_prop(
            profile.unwrap_or(&Value::Null),
            if code == "G1" {
                "feedRateMax"
            } else {
                "travelRateMax"
            },
        )?;
        let feed_limit = number_or_nan(feed_v);
        if f <= 0.0 || f > feed_limit {
            return Ok(result(
                &command,
                Some(format!(
                    "Feed rate fora do limite da rig (1–{} mm/min).",
                    js_to_string(feed_v)
                )),
            ));
        }
    }

    if code == "M104" || code == "M109" {
        let max_v = get_prop(tool.unwrap_or(&Value::Null), "nozzleTempMax")?;
        let max = number_or_nan(max_v);
        let s = params.s.unwrap_or(f64::NAN);
        if s.is_nan() || s < 0.0 || s > max {
            return Ok(result(
                &command,
                Some(format!(
                    "Temperatura do bico fora da faixa (0–{} °C).",
                    js_to_string(max_v)
                )),
            ));
        }
        if (code == "M109" || s > 60.0) && !ack_value(rig, "thermalRunaway")? {
            return Ok(result(
                &command,
                Some("Proteção thermal runaway não confirmada em RIG / MÁQUINA.".to_string()),
            ));
        }
    }
    if code == "M140" || code == "M190" {
        let max_v = get_prop(tool.unwrap_or(&Value::Null), "bedTempMax")?;
        let max = number_or_nan(max_v);
        let s = params.s.unwrap_or(f64::NAN);
        if s.is_nan() || s < 0.0 || s > max {
            return Ok(result(
                &command,
                Some(format!(
                    "Temperatura da mesa fora da faixa (0–{} °C).",
                    js_to_string(max_v)
                )),
            ));
        }
        if (code == "M190" || s > 60.0) && !ack_value(rig, "thermalRunaway")? {
            return Ok(result(
                &command,
                Some("Proteção thermal runaway não confirmada em RIG / MÁQUINA.".to_string()),
            ));
        }
    }
    if code == "M106" {
        let s = params.s.unwrap_or(f64::NAN);
        if s.is_nan() || s < 0.0 || s > 255.0 {
            return Ok(result(
                &command,
                Some("Ventoinha fora da faixa (0–255).".to_string()),
            ));
        }
    }
    if code == "M3" || code == "M4" {
        let enabled = truthy(get_prop(tool.unwrap_or(&Value::Null), "spindleEnabled")?);
        let firmware = ack_value(rig, "spindleFirmware")?;
        if !enabled || !firmware {
            return Ok(result(
                &command,
                Some("Fuso não habilitado. Confirme o suporte M3/M4/M5 no firmware em RIG / MÁQUINA.".to_string()),
            ));
        }
        if !ack_value(rig, "enclosure")? || !ack_value(rig, "workholding")? {
            return Ok(result(
                &command,
                Some(
                    "Confirme envelope fechado e fixação da peça antes de acionar o fuso."
                        .to_string(),
                ),
            ));
        }
        let min_v = get_prop(tool.unwrap_or(&Value::Null), "rpmMin")?;
        let max_v = get_prop(tool.unwrap_or(&Value::Null), "rpmMax")?;
        let min = number_or_nan(min_v);
        let max = number_or_nan(max_v);
        let s = params.s.unwrap_or(f64::NAN);
        if s.is_nan() || s < min || s > max {
            return Ok(result(
                &command,
                Some(format!(
                    "Rotação fora da faixa do fuso ({}–{} RPM).",
                    js_to_string(min_v),
                    js_to_string(max_v)
                )),
            ));
        }
    }

    Ok(result(&command, None))
}

// ---- exported functions ---------------------------------------------------------------------

/// Port of `allowedCommandsFor` (`src/hardware/commands.ts:24`).
pub fn allowed_commands_for(rig: Value) -> Result<Vec<String>, String> {
    allowed_commands_for_impl(&rig)
}

/// Port of `validateCommand` (`src/hardware/commands.ts:31`).
pub fn validate_command(raw: String, context: Value) -> Result<Value, String> {
    validate_command_impl(&raw, &context)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_like_js() {
        assert_eq!(normalize("  g0\tX10\nY20  "), "G0 X10 Y20");
        assert_eq!(normalize("straße"), "STRASSE");
        assert_eq!(normalize("\u{feff}bom"), "BOM");
    }

    #[test]
    fn token_accepts_only_the_allowlisted_shape() {
        assert!(token_ok("G0 X10 Y20 F3000"));
        assert!(token_ok("M104 S200.5"));
        assert!(!token_ok("G28.1"));
        assert!(!token_ok("X10"));
        assert!(!token_ok("G0 X.5"));
        assert!(!token_ok("G0 X+1"));
    }

    #[test]
    fn sorts_allowlist_as_js() {
        let rig = json!({ "mode": "cnc" });
        let out = allowed_commands_for(rig).unwrap_or_default();
        assert_eq!(out.first().map(String::as_str), Some("G0"));
        assert!(out.contains(&"M3".to_string()));
        assert!(!out.contains(&"M104".to_string()));
    }
}
