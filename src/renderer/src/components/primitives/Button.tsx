import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'icon'

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
  }
>

const baseClasses =
  'inline-flex items-center justify-center rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--kb-accent-rgb)/0.5)] disabled:cursor-not-allowed disabled:opacity-60'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'h-10 px-4 text-sm text-white bg-[rgb(var(--kb-accent-rgb))] shadow-[0_8px_24px_-12px_rgba(23,45,92,0.55)] hover:brightness-110',
  ghost:
    'h-9 px-3 text-sm text-[var(--kb-text-main)] bg-[var(--kb-bg-overlay)] hover:brightness-110',
  icon: 'h-8 w-8 text-[var(--kb-text-muted)] bg-transparent hover:bg-[var(--kb-bg-overlay)]'
}

function Button({
  children,
  className,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${className ?? ''}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
