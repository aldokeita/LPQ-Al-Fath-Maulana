const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ');

// Returns { name } when the rename is valid, or { error } with a message for the admin.
export const validateHafalanItemRename = ({ item, nextName, items = [] }) => {
  const name = normalize(nextName);
  if (!name) return { error: 'Nama hafalan tidak boleh kosong.' };
  if (name === normalize(item?.item_name)) return { name, unchanged: true };

  const duplicate = items.some((other) =>
    other?.id !== item?.id && normalize(other?.item_name).toLowerCase() === name.toLowerCase()
  );
  if (duplicate) return { error: `"${name}" sudah ada di kategori ini.` };

  return { name };
};
