import { Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { disconnectCar } from '../control/fleet';
import { t } from '../i18n/en';
import { SPEED_MAX, SPEED_MIN } from '../protocol/constants';
import { CAR_COLORS, useGarage } from '../store/garage';
import { useUi } from '../store/ui';
import { Button, IconButton, Row, Slider, Switch } from './primitives';
import { LiftStopSwitch, ObstacleStopControl } from './CarOptions';
import { useModal } from './useModal';

export function CarEditor() {
  const id = useUi((s) => s.editingCarId);
  const close = useUi((s) => s.editCar);
  const car = useGarage((s) => s.cars.find((c) => c.id === id));
  if (!id || !car) return null;
  return <EditorSheet key={car.id} carId={car.id} onClose={() => close(null)} />;
}

function EditorSheet({ carId, onClose }: { carId: string; onClose: () => void }) {
  const car = useGarage((s) => s.cars.find((c) => c.id === carId));
  const update = useGarage((s) => s.updateCar);
  const remove = useGarage((s) => s.removeCar);
  const [name, setName] = useState(car?.name ?? '');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const ref = useModal<HTMLDivElement>(onClose);
  if (!car) return null;

  return (
    <div className="scrim" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className="sheet glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
      >
        <div className="sheet__head">
          <h2 id="edit-title">{car.name}</h2>
          <IconButton label={t('common.close')} onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>
        <div className="sheet__body">
          <label className="field">
            <span className="field__label">{t('add.nameLabel')}</span>
            <input
              className="input"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => update(car.id, { name })}
              onKeyDown={(e) => e.key === 'Enter' && update(car.id, { name })}
            />
          </label>
          <div className="field">
            <span className="field__label" id="edit-color">
              {t('add.colorLabel')}
            </span>
            <div className="swatches" role="radiogroup" aria-labelledby="edit-color">
              {CAR_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={car.color === c.id}
                  aria-label={c.label}
                  className="swatch"
                  style={{ ['--tag' as string]: c.value }}
                  onClick={() => update(car.id, { color: c.id })}
                >
                  <span className="swatch__dot" />
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field__label">
              {t('group.speedFor', { name: car.name })} · <span className="num">{car.speed}</span>
            </span>
            <Slider
              label={t('group.speedFor', { name: car.name })}
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={1}
              value={car.speed}
              onChange={(v) => update(car.id, { speed: v })}
            />
          </div>
          <div className="car-options glass">
            <LiftStopSwitch car={car} withHint />
            <ObstacleStopControl car={car} />
          </div>
          <div className="rows glass">
            <Row
              label={t('group.reverseFor', { name: car.name })}
              hint={t('group.reverseHint')}
              control={
                <Switch
                  label={t('group.reverseFor', { name: car.name })}
                  checked={car.reversed}
                  onChange={(v) => update(car.id, { reversed: v })}
                />
              }
            />
          </div>
          {confirmRemove ? (
            <div className="confirm">
              <p>{t('group.removeConfirm', { name: car.name })}</p>
              <div className="confirm__actions">
                <Button variant="quiet" onClick={() => setConfirmRemove(false)}>
                  {t('group.keep', { name: car.name })}
                </Button>
                <Button
                  variant="glass"
                  className="btn--danger-text"
                  onClick={() => {
                    void disconnectCar(car.id);
                    remove(car.id);
                    onClose();
                  }}
                >
                  {t('group.removeNamed', { name: car.name })}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="quiet"
              className="btn--danger-text"
              icon={<Trash2 size={18} aria-hidden="true" />}
              onClick={() => setConfirmRemove(true)}
            >
              {t('common.remove')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
