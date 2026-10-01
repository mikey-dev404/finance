export const STUDENT_CATEGORIES: { name: string; kind: 'income' | 'expense'; color: string }[] = [
  { name: 'Študentski servis', kind: 'income', color: '#3F5C4A' },
  { name: 'Štipendija', kind: 'income', color: '#5B7C6A' },
  { name: 'Honorar', kind: 'income', color: '#6B8F71' },
  { name: 'Starši', kind: 'income', color: '#7A9E8A' }
]

export const STUDENT_EXPENSE_CATEGORIES: { name: string; kind: 'income' | 'expense'; color: string }[] = [
  { name: 'Najemnina', kind: 'expense', color: '#6B4F3A' },
  { name: 'Hrana', kind: 'expense', color: '#4A6741' },
  { name: 'Fitnes', kind: 'expense', color: '#7A3E52' },
  { name: 'Prevoz', kind: 'expense', color: '#3D5A73' },
  { name: 'Kava', kind: 'expense', color: '#9A3B24' },
  { name: 'Šola', kind: 'expense', color: '#5A4A73' },
  { name: 'Pretplate', kind: 'expense', color: '#3F5C6B' },
  { name: 'Računi', kind: 'expense', color: '#4A5568' },
  { name: 'Odplačila', kind: 'expense', color: '#6B3F3F' },
  { name: 'Ostalo', kind: 'expense', color: '#6B6560' }
]

export const SERVIS_CATEGORY = 'Študentski servis'
export const STIPENDIJA_CATEGORY = 'Štipendija'
export const RENT_CATEGORY_NAMES = ['Najemnina', 'Rent']
export const FOOD_CATEGORY_NAMES = ['Hrana', 'Groceries']
export const DEBT_CATEGORY_NAMES = ['Odplačila', 'Debt payments']
export const TRANSPORT_CATEGORY_NAMES = ['Prevoz', 'Transport']
