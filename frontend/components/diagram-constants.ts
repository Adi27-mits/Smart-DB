export const TABLE_WIDTH = 244
export const HEADER_HEIGHT = 42
export const ROW_HEIGHT = 30
export const CANVAS_PADDING = 80

export function tableHeight(columnCount: number) {
  return HEADER_HEIGHT + columnCount * ROW_HEIGHT
}
