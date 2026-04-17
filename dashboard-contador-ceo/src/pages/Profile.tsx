import { useState, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { PageLayout } from '@/components/layout/PageLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { RoleBadge } from '@/components/ui/Badge'
import { supabase } from '@/services/supabase'
import { Camera, Lock } from 'lucide-react'

export default function Profile() {
  const { profile, user } = useAuth()
  const [name, setName] = useState(profile?.name || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (file.size > 2 * 1024 * 1024) {
      setMessage('Imagem deve ter no máximo 2MB')
      return
    }

    setUploading(true)
    setMessage(null)

    const ext = file.name.split('.').pop()
    const filePath = `avatars/${user.id}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      setMessage('Erro ao enviar avatar: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
    const publicUrl = urlData.publicUrl

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id)

    if (updateError) {
      setMessage('Erro ao atualizar avatar: ' + updateError.message)
    } else {
      setAvatarUrl(publicUrl)
      setMessage('Avatar atualizado!')
    }
    setUploading(false)
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('user_profiles')
      .update({ name })
      .eq('id', user.id)

    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      setMessage('Perfil atualizado com sucesso!')
    }
    setSaving(false)
  }

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      setPasswordMsg('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('As senhas não coincidem')
      return
    }

    setChangingPassword(true)
    setPasswordMsg(null)

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordMsg('Erro ao alterar senha: ' + error.message)
    } else {
      setPasswordMsg('Senha alterada com sucesso!')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    }
    setChangingPassword(false)
  }

  return (
    <PageLayout title="Perfil">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-6">
          {/* Avatar & Info */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar name={profile?.name || ''} src={avatarUrl} size="xl" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera size={20} className="text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">{profile?.name}</h2>
              <p className="text-sm text-text-muted">{profile?.email}</p>
              <RoleBadge role={profile?.role || 'closer'} />
            </div>
          </div>

          <hr className="border-border" />

          {/* Edit */}
          <div className="space-y-4">
            <Input
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              label="E-mail"
              value={profile?.email || ''}
              disabled
            />

            {message && (
              <p className={`text-sm ${message.includes('Erro') ? 'text-danger' : 'text-success'}`}>
                {message}
              </p>
            )}

            <Button onClick={handleSave} loading={saving}>
              Salvar Alterações
            </Button>
          </div>
        </div>

        {/* Password Change */}
        <div className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center">
                <Lock size={16} className="text-text-muted" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Alterar Senha</h3>
            </div>
            {!showPasswordForm && (
              <Button variant="ghost" size="sm" onClick={() => setShowPasswordForm(true)}>
                Alterar
              </Button>
            )}
          </div>

          {showPasswordForm && (
            <div className="space-y-4">
              <Input
                label="Nova senha"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
              <Input
                label="Confirmar nova senha"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
              {passwordMsg && (
                <p className={`text-sm ${passwordMsg.includes('Erro') ? 'text-danger' : 'text-success'}`}>
                  {passwordMsg}
                </p>
              )}
              <div className="flex gap-2">
                <Button onClick={handlePasswordChange} loading={changingPassword} size="sm">
                  Salvar Senha
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  setShowPasswordForm(false)
                  setNewPassword('')
                  setConfirmPassword('')
                  setPasswordMsg(null)
                }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
