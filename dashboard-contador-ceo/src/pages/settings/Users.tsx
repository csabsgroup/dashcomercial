import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import { callPiperunProxy } from '@/services/piperunProxy'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Plus, Search, Trash2, KeyRound } from 'lucide-react'
import type { UserProfile, UserRole } from '@/types/database'
import { MOCK_ENABLED, MOCK_USERS } from '@/mocks/mockData'

interface PiperunUser {
  id: number
  name: string
  email: string
}

export default function UsersConfig() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deleting, setDeleting] = useState(false)

  // PipeRun users for linking
  const [piperunUsers, setPiperunUsers] = useState<PiperunUser[]>([])

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<UserRole>('closer')
  const [formPassword, setFormPassword] = useState('')
  const [formPiperunUserId, setFormPiperunUserId] = useState<string>('')
  const [formAvatarFile, setFormAvatarFile] = useState<File | null>(null)
  const [formAvatarPreview, setFormAvatarPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [resettingPassword, setResettingPassword] = useState<string | null>(null) // user id being reset

  const fetchUsers = async () => {
    if (MOCK_ENABLED) {
      setUsers(MOCK_USERS)
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .order('name')
    if (data) setUsers(data as UserProfile[])
    setLoading(false)
  }

  const fetchPiperunUsers = async () => {
    try {
      const res = await callPiperunProxy<PiperunUser>({
        endpoint: '/users',
        params: { show: '100' },
      })
      if (res.success && res.data) {
        setPiperunUsers(res.data)
      }
    } catch { /* ignore if proxy not configured */ }
  }

  useEffect(() => {
    fetchUsers()
    fetchPiperunUsers()
  }, [])

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const openCreate = () => {
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormRole('closer')
    setFormPassword('')
    setFormPiperunUserId('')
    setFormAvatarFile(null)
    setFormAvatarPreview(null)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (user: UserProfile) => {
    setEditingUser(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormRole(user.role)
    setFormPassword('')
    setFormPiperunUserId(user.piperun_user_id ? String(user.piperun_user_id) : '')
    setFormAvatarFile(null)
    setFormAvatarPreview(user.avatar_url || null)
    setFormError(null)
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setFormError(null)

    try {
      let avatarUrl: string | undefined

      // Upload avatar if provided
      if (formAvatarFile) {
        const userId = editingUser?.id || 'new'
        const ext = formAvatarFile.name.split('.').pop()
        const filePath = `avatars/${userId}-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, formAvatarFile, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
          avatarUrl = urlData.publicUrl
        }
      }

      if (editingUser) {
        // Update profile
        const updateData: Record<string, unknown> = {
          name: formName,
          role: formRole,
          piperun_user_id: formPiperunUserId ? Number(formPiperunUserId) : null,
        }
        if (avatarUrl) updateData.avatar_url = avatarUrl

        const { error } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('id', editingUser.id)
        if (error) throw error
      } else {
        // Create new user via Edge Function (admin endpoint)
        if (!formEmail || !formPassword || formPassword.length < 6) {
          setFormError('E-mail e senha (mínimo 6 caracteres) são obrigatórios.')
          setSaving(false)
          return
        }

        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email: formEmail,
              password: formPassword,
              name: formName,
              role: formRole,
              piperun_user_id: formPiperunUserId ? Number(formPiperunUserId) : null,
            }),
          }
        )

        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Erro ao criar usuário')
      }

      setModalOpen(false)
      fetchUsers()
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (user: UserProfile) => {
    await supabase
      .from('user_profiles')
      .update({ active: !user.active })
      .eq('id', user.id)
    fetchUsers()
  }

  const handleDelete = async () => {
    if (!deleteConfirmUser || deleteEmail !== deleteConfirmUser.email) return
    setDeleting(true)
    try {
      await supabase.from('user_profiles').delete().eq('id', deleteConfirmUser.id)
      setDeleteConfirmUser(null)
      setDeleteEmail('')
      fetchUsers()
    } catch {
      // ignore
    }
    setDeleting(false)
  }

  const handleResetPassword = async (user: UserProfile) => {
    setResettingPassword(user.id)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/perfil`,
      })
      if (error) throw error
      alert(`E-mail de redefinição enviado para ${user.email}`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao enviar e-mail de redefinição')
    } finally {
      setResettingPassword(null)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormAvatarFile(file)
      const reader = new FileReader()
      reader.onload = (ev) => setFormAvatarPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
            className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Todos os roles</option>
            <option value="master">Master</option>
            <option value="admin">Admin</option>
            <option value="closer">Closer</option>
            <option value="sdr">SDR</option>
          </select>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} /> Novo Usuário
        </Button>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : filtered.length === 0 ? (
          <p className="text-center text-text-muted py-8">Nenhum usuário encontrado</p>
        ) : (
          filtered.map((user) => (
                <div key={user.id} className="bg-surface rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar name={user.name} src={user.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">{user.name}</p>
                  <p className="text-xs text-text-muted truncate">{user.email}</p>
                </div>
                <span className={`text-xs font-medium ${user.active ? 'text-success' : 'text-danger'}`}>
                  {user.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <RoleBadge role={user.role} />
                {user.piperun_user_id ? (
                  <span className="text-success text-xs">✅ PipeRun #{user.piperun_user_id}</span>
                ) : (
                  <span className="text-text-faint text-xs">❌ Sem PipeRun</span>
                )}
              </div>
              <div className="flex gap-2 pt-1 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>Editar</Button>
                <Button variant="ghost" size="sm" onClick={() => toggleActive(user)}>
                  {user.active ? 'Desativar' : 'Ativar'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setDeleteConfirmUser(user); setDeleteEmail('') }}>
                  <Trash2 size={14} className="text-danger" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-text-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">PipeRun</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} src={user.avatar_url} size="sm" />
                        <div>
                          <p className="font-medium text-text-primary">{user.name}</p>
                          <p className="text-xs text-text-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                    <td className="px-4 py-3">
                      {user.piperun_user_id ? (
                        <span className="text-success text-xs">✅ ID: {user.piperun_user_id}</span>
                      ) : (
                        <span className="text-text-faint text-xs">❌ Não vinculado</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${user.active ? 'text-success' : 'text-danger'}`}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(user)}>
                          {user.active ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setDeleteConfirmUser(user); setDeleteEmail('') }}>
                          <Trash2 size={14} className="text-danger" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}>
        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {formAvatarPreview ? (
                <img src={formAvatarPreview} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-border" />
              ) : (
                <Avatar name={formName || '?'} size="lg" />
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-text-muted block mb-1">Avatar</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                className="text-xs text-text-muted file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border file:border-border file:text-text-primary file:bg-surface-2 file:text-xs file:cursor-pointer"
              />
            </div>
          </div>

          <Input label="Nome" value={formName} onChange={(e) => setFormName(e.target.value)} />
          <Input label="E-mail" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} disabled={!!editingUser} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-muted">Role</label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary"
            >
              <option value="closer">Closer</option>
              <option value="sdr">SDR</option>
              <option value="admin">Admin</option>
              <option value="master">Master</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-muted">Usuário PipeRun</label>
            <select
              value={formPiperunUserId}
              onChange={(e) => setFormPiperunUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-text-primary"
            >
              <option value="">Não vinculado</option>
              {piperunUsers.map(pu => (
                <option key={pu.id} value={String(pu.id)}>
                  {pu.name} ({pu.email})
                </option>
              ))}
            </select>
            {piperunUsers.length === 0 && (
              <p className="text-xs text-text-faint">PipeRun não configurado ou sem usuários</p>
            )}
          </div>
          {!editingUser && (
            <Input label="Senha" type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
          )}
          {editingUser && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleResetPassword(editingUser)}
              loading={resettingPassword === editingUser.id}
            >
              <KeyRound size={14} /> Redefinir Senha
            </Button>
          )}
          {formError && (
            <p className="text-sm text-danger">{formError}</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Salvar</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmUser} onClose={() => setDeleteConfirmUser(null)} title="Confirmar exclusão">
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            Para confirmar a exclusão de <strong>{deleteConfirmUser?.name}</strong>, digite o e-mail do usuário:
          </p>
          <Input
            label="E-mail de confirmação"
            value={deleteEmail}
            onChange={(e) => setDeleteEmail(e.target.value)}
            placeholder={deleteConfirmUser?.email}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteConfirmUser(null)}>Cancelar</Button>
            <Button
              onClick={handleDelete}
              loading={deleting}
              disabled={deleteEmail !== deleteConfirmUser?.email}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Excluir Permanentemente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
