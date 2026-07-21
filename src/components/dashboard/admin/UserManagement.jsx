import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Edit, Trash2, Search, Key } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const UserManagement = () => {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState({ guru: [], santri: [] });
  const [adminUser, setAdminUser] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', table: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadUsers();
  }, [authUser]);

  const loadUsers = async () => {
    if (authUser?.role === 'admin') {
      setAdminUser({ id: authUser.id, name: 'Admin', username: 'admin', role: 'admin', email: authUser.email });
    }

    const { data: guruData, error: guruError } = await supabase.from('guru').select('id, nama, email, password');
    const { data: santriData, error: santriError } = await supabase.from('santri').select('id, nama_lengkap, nama_panggilan, password, kategori');

    if (guruError || santriError) {
      toast({ title: 'Gagal memuat pengguna', variant: 'destructive' });
      return;
    }
    setUsers({ guru: guruData || [], santri: santriData || [] });
  };

  const handleEdit = (user, type) => {
    setEditingUser(user);
    const username = type === 'santri' ? user.nama_panggilan : (type === 'admin' ? 'admin' : user.email);
    setFormData({ id: user.id, username: username, password: '', table: type });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id, table) => {
    const displayName = table === 'guru' ? 'Guru' : 'Santri';
    const resetField = table === 'santri' ? 'nama_panggilan' : 'email';

    if(window.confirm(`Anda yakin ingin mereset login untuk pengguna ini? Username & Password akan dikosongkan.`)){
        const { error } = await supabase.from(table).update({ [resetField]: null, password: null }).eq('id', id);
        if (error) {
            toast({ title: "Gagal", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "Berhasil!", description: `Login untuk ${displayName} berhasil direset.` });
            loadUsers();
        }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username && formData.table !== 'admin') {
      toast({ title: "Gagal", description: "Username tidak boleh kosong.", variant: "destructive" });
      return;
    }

    const payload = {};
    if(formData.table === 'santri'){
        payload.nama_panggilan = formData.username;
    } else if (formData.table === 'guru') {
        payload.email = formData.username;
    }

    if (formData.password) {
      payload.password = formData.password;
    }

    if (formData.table === 'admin') {
        toast({ title: "Info", description: "Pengelolaan login admin dan guru kini dilakukan di tab masing-masing.", variant: "default" });
        setIsDialogOpen(false);
        return;
    }

    const { error } = await supabase.from(formData.table).update(payload).eq('id', editingUser.id);
    if (error) {
      toast({ title: "Gagal!", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Berhasil!", description: `Data login berhasil diperbarui.` });
      loadUsers();
      setIsDialogOpen(false);
    }
    setEditingUser(null);
  };

  const allUsers = [
    ...(adminUser ? [adminUser] : []),
    ...users.guru.map(u => ({...u, name: u.nama, username: u.email, role: 'guru', table: 'guru'})),
    ...users.santri.map(u => ({...u, name: u.nama_lengkap, username: u.nama_panggilan, role: `santri ${u.kategori}`, table: 'santri'}))
  ];

  const sortedUsers = useMemo(() => {
    return allUsers
      .filter(user =>
        (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      .sort((a, b) => {
        if (a.role === 'admin') return -1;
        if (b.role === 'admin') return 1;
        if (!a.name) return 1;
        if (!b.name) return -1;
        return a.name.localeCompare(b.name);
      });
  }, [allUsers, searchTerm]);

  return (
    <div className="bg-white dark:bg-[#112D4E] p-6 rounded-2xl shadow-xl">
      <h2 className="text-2xl font-bold text-[#3F72AF] mb-2">Manajemen Login Santri</h2>
      <p className="text-sm text-muted-foreground mb-4">Fitur ini untuk mengelola username dan password login santri. Untuk guru & admin, silakan kelola di tab masing-masing.</p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          placeholder="Cari nama atau username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="overflow-y-auto max-h-[60vh]">
        <table className="w-full">
          <thead className="sticky top-0 bg-white dark:bg-[#112D4E]">
            <tr className="border-b dark:border-gray-700">
              <th className="py-3 px-4 text-left">Nama</th>
              <th className="py-3 px-4 text-left">Role</th>
              <th className="py-3 px-4 text-left">Username Login</th>
              <th className="py-3 px-4 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.filter(u => u.role.includes('santri')).map(user => (
              <tr key={`${user.role}-${user.id}`} className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800`}>
                <td className="py-3 px-4 font-medium">{user.name}</td>
                <td className="py-3 px-4 capitalize">{user.role}</td>
                <td className="py-3 px-4">{user.username || '(Belum diatur)'}</td>
                <td className="py-3 px-4 flex gap-2">
                  <Button onClick={() => handleEdit(user, 'santri')} size="sm" variant="outline">
                    <Key className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Button onClick={() => handleDelete(user.id, user.table)} size="sm" variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> Reset
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Login untuk {editingUser?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username Login</label>
              <Input
                type="text"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password Baru</label>
              <Input
                type="text"
                placeholder="Kosongkan jika tidak ingin ganti"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit">Simpan Perubahan</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
