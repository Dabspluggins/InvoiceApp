export {}

declare global {
  interface TurnstileWidget {
    render(container: HTMLElement | string, options: Record<string, unknown>): string
    reset(widgetId?: string): void
    remove(widgetId: string): void
  }

  interface Window {
    turnstile?: TurnstileWidget
    onloadTurnstileCallback?: () => void
  }
}
