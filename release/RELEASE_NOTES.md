# TOKI — Industrial Operating System v0.1.0

Primeira versão distribuível da rig **Plotter + Impressora 3D + CNC**.

## Incluído

- Seis módulos: Overview, Plot Studio, Machine Control, Monitoring, Project Manager e System Center.
- Visualização da máquina em **vista normal (planta)** com eixos XYZ e cabeçote volumétrico em 3D.
- **Inspetor de peças**: seleção direta no modelo, ficha técnica, busca, filtros, zoom, vista explodida e alternância para **Órbita 3D** com arraste/rotação.
- Perfis por ferramenta com intertravamentos: troca de modo protegida, limites de envelope, confirmações físicas para fuso e controle térmico com `M105`.
- Conexão Marlin por WebSerial e **modo demo explicitamente identificado** para explorar a interface sem acionar hardware.
- Console de eventos com níveis `INFO / WARNING / ERROR / CRITICAL`.
- Interface responsiva para desktop, notebook, tablet e smartphone.

## Download

Baixe um dos arquivos desta release:

| Arquivo | Conteúdo | Uso |
| --- | --- | --- |
| `TOKI-v0.1.0-web.zip` | Build estático pronto (`index.html` + `assets/`) | Abrir ou hospedar sem instalar nada |
| `TOKI-v0.1.0-source.zip` | Código-fonte sem `node_modules` | Compilar com `npm install && npm run build` |
| `SHA256SUMS.txt` | Checksums dos dois ZIPs | Conferir integridade |

### Abrir o build

Extraia `TOKI-v0.1.0-web.zip` e abra `index.html` no navegador. Os caminhos dos recursos são relativos, então também funciona em qualquer subpasta de um servidor estático.

Para conectar hardware real, use **Chrome ou Edge** em `localhost` ou HTTPS, pois WebSerial não funciona em `file://` nem em conexões HTTP comuns. O modo demo funciona em qualquer navegador moderno e nunca envia comandos para a máquina.

## Segurança

- Nenhum comando é enviado antes de uma conexão confirmada por `M115`.
- `M3/M4/M5` exigem `spindleEnabled`, firmware compatível, envelope fechado e peça fixada.
- Extrusão exige sensor de temperatura válido e bico quente; aquecimento exige confirmação de `thermal runaway`.
- A visualização é esquemática: não substitui manual, desenho técnico nem procedimento de segurança.

## Estado

Versão `0.1.0` — release inicial.
