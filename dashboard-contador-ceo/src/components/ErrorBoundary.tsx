import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex items-center justify-center p-6">
          <div className="bg-surface border border-border rounded-2xl p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-danger" />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Algo deu errado
            </h2>
            <p className="text-sm text-text-muted mb-4">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            {this.state.error && (
              <pre className="text-xs text-text-faint bg-surface-2 rounded-xl p-3 mb-4 overflow-auto max-h-32 text-left">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                aria-label="Tentar novamente"
                className="px-4 py-2.5 rounded-xl bg-surface-2 text-text-primary text-sm font-medium hover:bg-surface-3 transition-all duration-200 cursor-pointer flex items-center gap-2"
              >
                <RefreshCw size={14} aria-hidden="true" />
                Tentar novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                aria-label="Recarregar página"
                className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-all duration-200 cursor-pointer"
              >
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
