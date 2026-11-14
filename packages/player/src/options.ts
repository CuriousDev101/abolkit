import type { UiStringKey } from '@abolkit/core'

export type OptionKey =
  | 'adMode'
  | 'signVisible'
  | 'audioOnly'
  | 'controlsKeys'
  | 'fontScale'
  | 'color'
  | 'background'
  | 'backgroundOpacity'
  | 'position'
  | 'edge'

export interface PlayerOption {
  key: OptionKey
  label: UiStringKey
  /**
   * Where the Video.js skin shows it: `main` in the settings menu, `caption` under "Caption style" in the captions
   * menu, `bar` as its own control-bar button. The native fallback panel lists them all.
   */
  group: 'main' | 'caption' | 'bar'
  /** [value, label]; a label that is a UI string key is translated, anything else is shown as is. */
  choices: ReadonlyArray<readonly [string, string]>
}

const ON_OFF = [
  ['on', 'on'],
  ['off', 'off'],
] as const

/** Viewer options outside Video.js's own features (speed, quality, audio and caption tracks stay Video.js menus). */
export const OPTIONS: readonly PlayerOption[] = [
  {
    key: 'adMode',
    label: 'audioDescription',
    group: 'main',
    choices: [
      ['off', 'adOff'],
      ['text', 'adText'],
      ['voice', 'adVoice'],
    ],
  },
  { key: 'signVisible', label: 'signToggle', group: 'bar', choices: ON_OFF },
  { key: 'audioOnly', label: 'audioOnly', group: 'main', choices: ON_OFF },
  {
    key: 'controlsKeys',
    label: 'shortcuts',
    group: 'main',
    choices: [
      ['focus', 'shortcutsOn'],
      ['off', 'shortcutsOff'],
    ],
  },
  {
    key: 'fontScale',
    label: 'captionSize',
    group: 'caption',
    choices: [
      ['0.75', '75%'],
      ['1', '100%'],
      ['1.25', '125%'],
      ['1.5', '150%'],
      ['2', '200%'],
    ],
  },
  {
    key: 'color',
    label: 'captionColor',
    group: 'caption',
    choices: [
      ['#ffffff', 'white'],
      ['#ffff00', 'yellow'],
      ['#00ff00', 'green'],
      ['#00ffff', 'cyan'],
    ],
  },
  {
    key: 'background',
    label: 'captionBackground',
    group: 'caption',
    choices: [
      ['#000000', 'black'],
      ['#0000aa', 'blue'],
      ['#333333', 'grey'],
    ],
  },
  {
    key: 'backgroundOpacity',
    label: 'backgroundOpacity',
    group: 'caption',
    choices: [
      ['0', '0%'],
      ['0.5', '50%'],
      ['0.75', '75%'],
      ['1', '100%'],
    ],
  },
  {
    key: 'position',
    label: 'captionPosition',
    group: 'caption',
    choices: [
      ['bottom', 'positionBottom'],
      ['top', 'positionTop'],
    ],
  },
  {
    key: 'edge',
    label: 'captionEdge',
    group: 'caption',
    choices: [
      ['none', 'edgeNone'],
      ['shadow', 'edgeShadow'],
      ['outline', 'edgeOutline'],
    ],
  },
]
