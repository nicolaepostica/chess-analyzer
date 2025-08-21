import { SECONDARY_BUTTON } from './buttonStyles'

export type GameControlsProps = {
  canTakeBack: boolean
  canHint: boolean
  evalVisible: boolean
  disabled: boolean
  onTakeBack: () => void
  onHint: () => void
  onToggleEval: () => void
  onOfferDraw: () => void
  onResign: () => void
}

export function GameControls(props: GameControlsProps) {
  const { disabled } = props
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={SECONDARY_BUTTON} disabled={disabled || !props.canTakeBack} onClick={props.onTakeBack}>
        Take back
      </button>
      <button type="button" className={SECONDARY_BUTTON} disabled={disabled || !props.canHint} onClick={props.onHint}>
        Hint
      </button>
      <button type="button" className={SECONDARY_BUTTON} onClick={props.onToggleEval}>
        {props.evalVisible ? 'Hide eval bar' : 'Show eval bar'}
      </button>
      <button type="button" className={SECONDARY_BUTTON} disabled={disabled} onClick={props.onOfferDraw}>
        Offer draw
      </button>
      <button type="button" className={SECONDARY_BUTTON} disabled={disabled} onClick={props.onResign}>
        Resign
      </button>
    </div>
  )
}
