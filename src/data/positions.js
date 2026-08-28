export const POSITIONS = [
  'GK',
  'RB',
  'RWB',
  'CB',
  'LB',
  'LWB',
  'CDM',
  'CM',
  'CAM',
  'RM',
  'RW',
  'LM',
  'LW',
  'CF',
  'ST',
]

export const POSITION_LABELS = {
  GK: 'Goleiro',
  RB: 'Lateral direito',
  RWB: 'Ala direito',
  CB: 'Zagueiro',
  LB: 'Lateral esquerdo',
  LWB: 'Ala esquerdo',
  CDM: 'Volante',
  CM: 'Meio-campo',
  CAM: 'Meia-atacante',
  RM: 'Meia direita',
  RW: 'Ponta direita',
  LM: 'Meia esquerda',
  LW: 'Ponta esquerda',
  CF: 'Segundo atacante',
  ST: 'Centroavante',
}

export const LINE_COLORS = {
  ataque: '#ff6b4a',
  meioOfensivo: '#5dff9a',
  meioDefensivo: '#b45cff',
  defesa: '#3dd6ff',
  goleiro: '#f5c400',
}

export const LINE_GROUPS = [
  {
    id: 'ataque',
    label: 'Ataque',
    color: LINE_COLORS.ataque,
    codes: ['ST', 'CF'],
  },
  {
    id: 'meioOfensivo',
    label: 'Meio-campo ofensivo',
    color: LINE_COLORS.meioOfensivo,
    codes: ['CAM', 'LM', 'RM', 'LW', 'RW'],
  },
  {
    id: 'meioDefensivo',
    label: 'Meio-campo defensivo',
    color: LINE_COLORS.meioDefensivo,
    codes: ['CDM', 'CM'],
  },
  {
    id: 'defesa',
    label: 'Defesa',
    color: LINE_COLORS.defesa,
    codes: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  },
  {
    id: 'goleiro',
    label: 'Goleiro',
    color: LINE_COLORS.goleiro,
    codes: ['GK'],
  },
]

export const POSITION_COLORS = Object.fromEntries(
  LINE_GROUPS.flatMap((group) => group.codes.map((code) => [code, group.color])),
)
