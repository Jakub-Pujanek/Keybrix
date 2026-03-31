type ShortcutTagProps = {
  shortcut: string
}

function ShortcutTag({ shortcut }: ShortcutTagProps): React.JSX.Element {
  return (
    <span className="inline-flex rounded-sm bg-[#ff821f] px-2 py-1 text-[10px] font-bold tracking-[0.15em] text-white">
      {shortcut}
    </span>
  )
}

export default ShortcutTag
