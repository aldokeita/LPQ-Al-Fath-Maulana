// xlsx is ~400 KB raw and only needed when a user actually exports or
// imports a spreadsheet. Loading it on demand keeps it out of every chunk
// that statically imported it (the shared dashboard chunk in particular,
// which all roles download).
export const loadXlsx = () => import('xlsx');
