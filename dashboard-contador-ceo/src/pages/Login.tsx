import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { error: err } = await signUp(email, password, name)
        if (err) {
          setError(err)
        } else {
          setError(null)
          setIsSignUp(false)
        }
      } else {
        const { error: err } = await signIn(email, password)
        if (err) {
          setError(err)
        } else {
          navigate('/dashboard')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Left — Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-gradient relative overflow-hidden items-center justify-center">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-[10%] left-[10%] w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-[15%] right-[5%] w-96 h-96 bg-black/10 rounded-full blur-3xl" />
          <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/5 rounded-full" />
          <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border border-white/8 rounded-full" />
        </div>

        <div className="relative z-10 text-center px-12">
          <img
            src="/LOGO CEO BRANCO.png"
            alt="Contador CEO"
            className="h-20 mx-auto mb-8 drop-shadow-2xl"
          />
          <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">
            Programa de Acompanhamento
          </h2>
          <p className="text-white/70 text-lg max-w-sm mx-auto leading-relaxed">
            Gerencie metas, acompanhe rankings e potencialize resultados do seu time comercial.
          </p>
        </div>
      </div>

      {/* Right — Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <img
              src="/LOGO CEO VERMELHO.png.png"
              alt="Contador CEO"
              className="h-12 mx-auto mb-3"
            />
            <p className="text-sm text-text-muted">
              Programa de Acompanhamento
            </p>
          </div>

          {/* Form heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              {isSignUp ? 'Criar Conta' : 'Bem-vindo de volta'}
            </h1>
            <p className="text-sm text-text-muted mt-1">
              {isSignUp ? 'Preencha os dados para criar sua conta' : 'Acesse sua conta para continuar'}
            </p>
          </div>

          {/* Card */}
          <div className="bg-surface rounded-2xl border border-border p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {isSignUp && (
                <Input
                  label="Nome Completo"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}

              <Input
                label="E-mail"
                type="email"
                placeholder="seu@absgroup.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                label="Senha"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />

              {error && (
                <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <Button type="submit" loading={loading} className="w-full" size="lg">
                {isSignUp ? 'Criar Conta' : 'Entrar'}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                }}
                className="text-sm text-text-muted hover:text-primary transition-colors cursor-pointer"
              >
                {isSignUp ? 'Já tenho conta — Entrar' : 'Primeira vez? Criar conta'}
              </button>
            </div>
          </div>

          <p className="text-xs text-text-faint text-center mt-6">
            Apenas e-mails @absgroup.com.br são permitidos
          </p>
        </div>
      </div>
    </div>
  )
}
