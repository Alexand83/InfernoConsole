// Sistema di colori per DJ connessi
export interface DJColor {
  id: string
  name: string
  color: string
  bgColor: string
  borderColor: string
}

// Palette di colori predefinita per DJ
const DJ_COLORS = [
  { name: 'Rosso', color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fecaca' },
  { name: 'Arancione', color: '#f97316', bgColor: '#fff7ed', borderColor: '#fed7aa' },
  { name: 'Giallo', color: '#eab308', bgColor: '#fefce8', borderColor: '#fde047' },
  { name: 'Verde', color: '#22c55e', bgColor: '#f0fdf4', borderColor: '#bbf7d0' },
  { name: 'Teal', color: '#14b8a6', bgColor: '#f0fdfa', borderColor: '#99f6e4' },
  { name: 'Ciano', color: '#06b6d4', bgColor: '#ecfeff', borderColor: '#a5f3fc' },
  { name: 'Blu', color: '#3b82f6', bgColor: '#eff6ff', borderColor: '#bfdbfe' },
  { name: 'Indaco', color: '#6366f1', bgColor: '#eef2ff', borderColor: '#c7d2fe' },
  { name: 'Viola', color: '#8b5cf6', bgColor: '#faf5ff', borderColor: '#ddd6fe' },
  { name: 'Fucsia', color: '#d946ef', bgColor: '#fdf4ff', borderColor: '#fae8ff' },
  { name: 'Rosa', color: '#ec4899', bgColor: '#fdf2f8', borderColor: '#fce7f3' },
  { name: 'Lime', color: '#84cc16', bgColor: '#f7fee7', borderColor: '#d9f99d' },
  { name: 'Emeraldo', color: '#10b981', bgColor: '#ecfdf5', borderColor: '#a7f3d0' },
  { name: 'Ambra', color: '#f59e0b', bgColor: '#fffbeb', borderColor: '#fde68a' },
  { name: 'Zaffiro', color: '#0ea5e9', bgColor: '#f0f9ff', borderColor: '#bae6fd' },
  { name: 'Magenta', color: '#d946ef', bgColor: '#fdf4ff', borderColor: '#fae8ff' },
  { name: 'Turchese', color: '#0891b2', bgColor: '#ecfeff', borderColor: '#a5f3fc' },
  { name: 'Corallo', color: '#ff6b6b', bgColor: '#fff5f5', borderColor: '#fecaca' },
  { name: 'Lavanda', color: '#a78bfa', bgColor: '#faf5ff', borderColor: '#ddd6fe' },
  { name: 'Menta', color: '#6ee7b7', bgColor: '#f0fdf4', borderColor: '#bbf7d0' }
]

// Colori già assegnati
const assignedColors = new Set<string>()

// Funzione per ottenere un colore unico per un DJ
export const getDJColor = (djName: string): DJColor => {
  // Se il DJ ha già un colore assegnato, restituiscilo
  const existingColor = assignedColors.has(djName)
  if (existingColor) {
    const colorIndex = Array.from(assignedColors).indexOf(djName) % DJ_COLORS.length
    return {
      id: djName,
      name: DJ_COLORS[colorIndex].name,
      color: DJ_COLORS[colorIndex].color,
      bgColor: DJ_COLORS[colorIndex].bgColor,
      borderColor: DJ_COLORS[colorIndex].borderColor
    }
  }

  // Trova un colore non utilizzato
  let availableColor = DJ_COLORS.find(color => !assignedColors.has(color.name))
  
  // Se tutti i colori sono utilizzati, usa un colore casuale
  if (!availableColor) {
    const randomIndex = Math.floor(Math.random() * DJ_COLORS.length)
    availableColor = DJ_COLORS[randomIndex]
  }

  // Assegna il colore al DJ
  assignedColors.add(djName)

  return {
    id: djName,
    name: availableColor.name,
    color: availableColor.color,
    bgColor: availableColor.bgColor,
    borderColor: availableColor.borderColor
  }
}

// Funzione per liberare un colore quando un DJ si disconnette
export const releaseDJColor = (djName: string): void => {
  assignedColors.delete(djName)
}

// Funzione per ottenere il colore di un DJ specifico
export const getDJColorByName = (djName: string): DJColor | null => {
  if (!assignedColors.has(djName)) return null
  
  const colorIndex = Array.from(assignedColors).indexOf(djName) % DJ_COLORS.length
  return {
    id: djName,
    name: DJ_COLORS[colorIndex].name,
    color: DJ_COLORS[colorIndex].color,
    bgColor: DJ_COLORS[colorIndex].bgColor,
    borderColor: DJ_COLORS[colorIndex].borderColor
  }
}

// Funzione per resettare tutti i colori (utile per test)
export const resetDJColors = (): void => {
  assignedColors.clear()
}

