import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'icon'

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
  }
>

const baseClasses =
  'inline-flex items-center justify-center rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/60 disabled:cursor-not-allowed disabled:opacity-60'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'h-10 px-4 text-sm text-white bg-gradient-to-b from-[#7c9cff] to-[#f1772f] shadow-[0_8px_24px_-12px_rgba(98,129,255,0.9)] hover:brightness-110',
  ghost: 'h-9 px-3 text-sm text-slate-200 bg-white/5 hover:bg-white/10',
  icon: 'h-8 w-8 text-slate-300 bg-transparent hover:bg-white/10'
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
