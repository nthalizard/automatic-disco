export const C = {
  bg: "#0E1116", panel: "#161B22", panel2: "#1C232C", edge: "#2A333F",
  edgeSoft: "#212A34", ink: "#EAF1F8", inkDim: "#8C99AB", inkFaint: "#5B6572",
  amber: "#E0A458", laser: "#FF4436", ok: "#3DD68C", warn: "#E8B341", bad: "#FF5A52",
  readout: "#F2F7FC", shaft: "#6FA8DC",
} as const;

export type Palette = { [K in keyof typeof C]: string };

/** Light palette for printed reports. */
export const PRINT: Palette = {
  bg: "#FFFFFF", panel: "#FFFFFF", panel2: "#F1F3F6", edge: "#9AA3AE",
  edgeSoft: "#C9CFD6", ink: "#111418", inkDim: "#4A5361", inkFaint: "#7A8491",
  amber: "#A15C00", laser: "#C62A1E", ok: "#137A45", warn: "#9A6B00", bad: "#C02A22",
  readout: "#111418", shaft: "#1D5FA8",
};
