import type { RigMode, RigTool } from '@/types';

export type PartGroup = 'estrutura' | 'movimento' | 'ferramenta';

export interface PartContext {
  mode: RigMode;
  tool?: RigTool;
  bed: { width: number; height: number; maxZ?: number };
}

export interface MachinePart {
  id: string;
  name: string;
  code: string;
  group: PartGroup;
  description: string;
  spec: string | ((context: PartContext) => string);
  /** Quando informado, a peça só existe nesses modos da rig. */
  modes?: RigMode[];
  tags?: string[];
}

export const PART_GROUP_LABEL: Record<PartGroup, string> = {
  estrutura: 'ESTRUTURA',
  movimento: 'MOVIMENTO',
  ferramenta: 'FERRAMENTA',
};

const bedSpec = (context: PartContext): string =>
  `${context.bed.width} × ${context.bed.height} mm${context.bed.maxZ ? ` · Z máx. ${context.bed.maxZ} mm` : ''}`;

export const MACHINE_PARTS: MachinePart[] = [
  {
    id: 'frame',
    name: 'Estrutura da base',
    code: 'FRM-01',
    group: 'estrutura',
    description: 'Vigas perfiladas que sustentam o leito, os trilhos e o pórtico. Define a rigidez e a geometria da máquina.',
    spec: bedSpec,
    tags: ['base', 'viga', 'chassi', 'perfil'],
  },
  {
    id: 'frame-slot',
    name: 'Rasgos de montagem',
    code: 'FRM-02',
    group: 'estrutura',
    description: 'Canais nos perfis para fixação de suportes, sensores e acessórios com porcas T.',
    spec: 'Rasgos contínuos nos quatro lados do chassi',
    tags: ['slot', 'rasgo', 'porca t', 'perfil'],
  },
  {
    id: 'foot',
    name: 'Pés niveladores',
    code: 'FRM-03',
    group: 'estrutura',
    description: 'Suportes de nivelamento e isolamento da base contra vibração e superfícies irregulares.',
    spec: '4 unidades · ajuste mecânico manual',
    tags: ['pe', 'nivelamento', 'vibracao'],
  },
  {
    id: 'fastener',
    name: 'Fixações',
    code: 'FRM-04',
    group: 'estrutura',
    description: 'Parafusos e inserts que prendem cantoneiras, trilhos, polias e suportes da ferramenta.',
    spec: 'Conjunto de parafusos com cabeça sextavada',
    tags: ['parafuso', 'porca', 'fixacao', 'bolt'],
  },
  {
    id: 'bed',
    name: 'Leito / mesa',
    code: 'BED-01',
    group: 'estrutura',
    description: 'Superfície de referência onde o trabalho é fixado. O contorno representa o envelope útil do perfil ativo.',
    spec: bedSpec,
    tags: ['mesa', 'leito', 'envelope', 'cama'],
  },
  {
    id: 'bed-inset',
    name: 'Superfície de fixação',
    code: 'BED-02',
    group: 'estrutura',
    description: 'Área útil interna do leito, usada como referência visual para fixação e alinhamento do material.',
    spec: (context) => `Recuo perimetral de 6 mm · ${context.bed.width} × ${context.bed.height} mm nominais`,
    tags: ['superficie', 'fixacao', 'area util'],
  },
  {
    id: 'bed-grid',
    name: 'Grade de referência',
    code: 'BED-03',
    group: 'estrutura',
    description: 'Malha visual de 30 mm para leitura rápida de posição e alinhamento. Não é uma peça física.',
    spec: 'Passo visual de 30 mm · sobreposição de referência',
    tags: ['grade', 'grid', 'referencia', 'escala'],
  },
  {
    id: 'y-rail',
    name: 'Trilho linear Y',
    code: 'MOT-01',
    group: 'movimento',
    description: 'Guia linear paralela que define o deslocamento do carro no eixo Y e limita o seguinte lateral.',
    spec: (context) => `2 trilhos · curso nominal ${context.bed.height} mm`,
    tags: ['trilho', 'linear', 'guia', 'y'],
  },
  {
    id: 'y-carriage',
    name: 'Carro linear Y',
    code: 'MOT-02',
    group: 'movimento',
    description: 'Bloco que desliza sobre cada trilho e transmite o movimento da transmissão para a estrutura móvel.',
    spec: '2 carros · um por trilho',
    tags: ['carro', 'porta rolamento', 'y'],
  },
  {
    id: 'lead-screw',
    name: 'Fuso de avanço Y',
    code: 'MOT-03',
    group: 'movimento',
    description: 'Haste rosqueada que converte rotação do motor em deslocamento linear controlado.',
    spec: 'Rosca visível representada por marcas no eixo',
    tags: ['fuso', 'rosca', 'transmissao', 'y'],
  },
  {
    id: 'y-motor',
    name: 'Motor de passo Y',
    code: 'MOT-04',
    group: 'movimento',
    description: 'Atuador responsável pelo movimento do eixo Y. Comandos de passo são enviados pelo firmware.',
    spec: 'Motor de passo · acoplamento ao fuso',
    tags: ['motor', 'stepper', 'passo', 'y'],
  },
  {
    id: 'gantry',
    name: 'Viga do pórtico X',
    code: 'MOT-05',
    group: 'movimento',
    description: 'Travessa que sustenta a correia X, as guias Z e o conjunto da ferramenta.',
    spec: (context) => `Vão aproximado de ${context.bed.width + 24} mm conforme envelope ativo`,
    tags: ['pontico', 'viga', 'x', 'gantry'],
  },
  {
    id: 'belt',
    name: 'Correia dentada X',
    code: 'MOT-06',
    group: 'movimento',
    description: 'Transmissão que move a ferramenta ao longo do eixo X entre as polias do pórtico.',
    spec: 'Traçado duplo · tensão mecânica ajustável',
    tags: ['correia', 'belt', 'x', 'transmissao'],
  },
  {
    id: 'pulley',
    name: 'Polia da correia X',
    code: 'MOT-07',
    group: 'movimento',
    description: 'Polia de retorno e tensionamento da correia X nas extremidades do pórtico.',
    spec: '2 polias · eixo paralelo ao pórtico',
    tags: ['polia', 'pulley', 'x', 'correia'],
  },
  {
    id: 'z-rail',
    name: 'Guia linear Z',
    code: 'MOT-08',
    group: 'movimento',
    description: 'Par de guias verticais que controla a altura da ferramenta e mantém a perpendicularidade.',
    spec: (context) => `Curso representado até ${context.tool?.safeZ ?? 10} mm de altura segura`,
    tags: ['guia', 'trilho', 'z', 'vertical'],
  },
  {
    id: 'z-carriage',
    name: 'Carro da ferramenta',
    code: 'MOT-09',
    group: 'movimento',
    description: 'Suporte que concentra a ferramenta e acompanha os movimentos X e Z do pórtico.',
    spec: 'Placa de montagem universal por modo',
    tags: ['carro', 'suporte', 'ferramenta', 'z'],
  },
  {
    id: 'hotend-carriage',
    name: 'Placa da ferramenta',
    code: 'TLT-01',
    group: 'ferramenta',
    description: 'Interface mecânica entre o carro Z e o módulo da ferramenta instalada.',
    spec: (context) => context.tool?.label ?? 'Ferramenta padrão',
    modes: ['plotter', 'printer3d', 'cnc'],
    tags: ['placa', 'suporte', 'carriage'],
  },
  {
    id: 'filament-tube',
    name: 'Guia de filamento',
    code: 'TLT-02',
    group: 'ferramenta',
    description: 'Tubo que conduz o filamento até o mecanismo de extrusão e protege a entrada do hotend.',
    spec: 'Alimentação superior do material',
    modes: ['printer3d'],
    tags: ['filamento', 'tubo', 'extrusor', '3d'],
  },
  {
    id: 'heatsink',
    name: 'Dissipador do hotend',
    code: 'TLT-03',
    group: 'ferramenta',
    description: 'Aletas que removem calor da zona fria e mantêm o gradiente térmico do bico.',
    spec: '5 aletas · região de transição térmica',
    modes: ['printer3d'],
    tags: ['dissipador', 'aletas', 'hotend', '3d'],
  },
  {
    id: 'heat-block',
    name: 'Bloco aquecido',
    code: 'TLT-04',
    group: 'ferramenta',
    description: 'Bloco onde o material é levado à temperatura de extrusão antes de passar pelo bico.',
    spec: (context) => `Temperatura máxima do perfil: ${context.tool?.nozzleTempMax ?? '—'} °C · leitura por M105`,
    modes: ['printer3d'],
    tags: ['bloco', 'aquecedor', 'hotend', 'temperatura'],
  },
  {
    id: 'nozzle',
    name: 'Bico de extrusão',
    code: 'TLT-05',
    group: 'ferramenta',
    description: 'Saída calibrada do material fundido. A extrusão depende de bico quente e sensor válido.',
    spec: (context) => context.tool?.label ?? 'Bico padrão',
    modes: ['printer3d'],
    tags: ['bico', 'nozzle', 'extrusao', '3d'],
  },
  {
    id: 'part-fan',
    name: 'Ventoinha de peça',
    code: 'TLT-06',
    group: 'ferramenta',
    description: 'Fluxo de ar direcionado ao material recém-depositado para estabilizar o resfriamento.',
    spec: 'Duto lateral · representação esquemática',
    modes: ['printer3d'],
    tags: ['ventoinha', 'fan', 'resfriamento', '3d'],
  },
  {
    id: 'spindle-body',
    name: 'Corpo do fuso',
    code: 'TLT-07',
    group: 'ferramenta',
    description: 'Módulo motorizado que gira a ferramenta de corte quando o firmware suporta M3/M4/M5.',
    spec: (context) =>
      `Faixa ${context.tool?.rpmMin ?? '—'}–${context.tool?.rpmMax ?? '—'} rpm · padrão ${context.tool?.rpmDefault ?? '—'} rpm · estado comandado`,
    modes: ['cnc'],
    tags: ['fuso', 'spindle', 'motor', 'cnc'],
  },
  {
    id: 'collet',
    name: 'Pinça coleta',
    code: 'TLT-08',
    group: 'ferramenta',
    description: 'Elemento de fixação da broca ou fresas no eixo do fuso.',
    spec: 'Collet cônico · aperto mecânico',
    modes: ['cnc'],
    tags: ['pinça', 'collet', 'broca', 'cnc'],
  },
  {
    id: 'bit',
    name: 'Ferramenta de corte',
    code: 'TLT-09',
    group: 'ferramenta',
    description: 'Broca/fresa com flautas que remove material. A rotação exige envelope fechado e peça fixada.',
    spec: 'Haste representada com flautas helicoidais',
    modes: ['cnc'],
    tags: ['broca', 'fresa', 'corte', 'bit', 'cnc'],
  },
  {
    id: 'spindle-cable',
    name: 'Cabo do fuso',
    code: 'TLT-10',
    group: 'ferramenta',
    description: 'Alimentação e sinal de controle do módulo de fuso. Deve ser fixado fora da área de corte.',
    spec: 'Cabo flexível de comando e potência',
    modes: ['cnc'],
    tags: ['cabo', 'fio', 'fuso', 'cnc'],
  },
  {
    id: 'dust-shoe',
    name: 'Sapato de coleta',
    code: 'TLT-11',
    group: 'ferramenta',
    description: 'Duto inferior para extração de cavacos e pó na região de usinagem.',
    spec: 'Abertura frontal · conexão de extração externa',
    modes: ['cnc'],
    tags: ['poeira', 'extracao', 'sapato', 'cnc'],
  },
  {
    id: 'pen-clamp',
    name: 'Suporte da caneta',
    code: 'TLT-12',
    group: 'ferramenta',
    description: 'Garra que prende a caneta técnica ao carro da ferramenta com alinhamento manual.',
    spec: 'Fixação por dois parafusos',
    modes: ['plotter'],
    tags: ['caneta', 'suporte', 'garra', 'plotter'],
  },
  {
    id: 'pen-barrel',
    name: 'Corpo da caneta',
    code: 'TLT-13',
    group: 'ferramenta',
    description: 'Corpo da ferramenta de desenho usada no modo plotter.',
    spec: (context) => context.tool?.label ?? 'Caneta técnica',
    modes: ['plotter'],
    tags: ['caneta', 'corpo', 'plotter'],
  },
  {
    id: 'pen-tip',
    name: 'Ponta da caneta',
    code: 'TLT-14',
    group: 'ferramenta',
    description: 'Ponta de contato com o papel. Define a largura do traço e a altura de trabalho.',
    spec: (context) => `Z de trabalho ${context.tool?.workZ ?? 0} mm · Z seguro ${context.tool?.safeZ ?? 5} mm`,
    modes: ['plotter'],
    tags: ['ponta', 'traco', 'plotter'],
  },
];

const PART_INDEX = new Map(MACHINE_PARTS.map((part) => [part.id, part]));

export const getMachinePart = (id: string | null | undefined): MachinePart | undefined =>
  id ? PART_INDEX.get(id) : undefined;

export const getPartSpec = (part: MachinePart, context: PartContext): string =>
  typeof part.spec === 'function' ? part.spec(context) : part.spec;

export const partsForMode = (mode: RigMode): MachinePart[] =>
  MACHINE_PARTS.filter((part) => !part.modes || part.modes.includes(mode));
