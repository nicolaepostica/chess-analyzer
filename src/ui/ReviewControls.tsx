import type { ReactNode } from 'react'

export type ReviewControlsProps = {
  playing: boolean
  atStart: boolean
  atEnd: boolean
  onFirst: () => void
  onPrevious: () => void
  onTogglePlay: () => void
  onNext: () => void
  onLast: () => void
}

const BUTTON =
  'flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-white/4 text-fg hover:bg-white/8 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-white/4'

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
    {path}
  </svg>
)

export function ReviewControls(props: ReviewControlsProps) {
  const { playing, atStart, atEnd } = props
  return (
    <div className="flex gap-2">
      <button type="button" aria-label="First move" className={BUTTON} disabled={atStart} onClick={props.onFirst}>
        {icon(<path d="M6 5h2v14H6zm3.5 7L18 5.5v13z" />)}
      </button>
      <button type="button" aria-label="Previous move" className={BUTTON} disabled={atStart} onClick={props.onPrevious}>
        {icon(<path d="M15.5 5.5 9 12l6.5 6.5-1.4 1.4L6.2 12l7.9-7.9z" />)}
      </button>
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        className={BUTTON}
        disabled={atEnd && !playing}
        onClick={props.onTogglePlay}
      >
        {playing ? icon(<path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z" />) : icon(<path d="M8 5v14l11-7z" />)}
      </button>
      <button type="button" aria-label="Next move" className={BUTTON} disabled={atEnd} onClick={props.onNext}>
        {icon(<path d="M8.5 5.5 15 12l-6.5 6.5 1.4 1.4 7.9-7.9-7.9-7.9z" />)}
      </button>
      <button type="button" aria-label="Last move" className={BUTTON} disabled={atEnd} onClick={props.onLast}>
        {icon(<path d="M16 5h2v14h-2zm-1.5 7L6 18.5v-13z" />)}
      </button>
    </div>
  )
}
