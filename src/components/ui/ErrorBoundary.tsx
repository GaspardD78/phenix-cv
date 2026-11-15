import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-[var(--pc-bg)]">
          <div className="text-center max-w-md p-8">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-[var(--pc-text)] mb-2">
              Une erreur critique est survenue
            </h1>
            <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)] mb-4">
              {this.state.error?.message || 'Erreur inconnue'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-lagon-600 text-white rounded-md hover:bg-lagon-700 transition-colors font-medium text-sm"
            >
              Relancer l'application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
