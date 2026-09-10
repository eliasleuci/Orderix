import React from 'react';
import Badge from '../../../components/ui/Badge';
import { BILLING_LABELS, BillingState } from '../../../types/superadmin';

const VARIANTES: Record<BillingState, 'success' | 'warning' | 'danger' | 'neutral'> = {
  AL_DIA: 'success',
  POR_VENCER: 'warning',
  VENCIDO: 'danger',
  SIN_FECHA: 'neutral',
};

interface Props {
  state: BillingState;
  dias?: number | null;
}

/** Estado de facturación. Los días sólo se muestran cuando aportan urgencia. */
const SubscriptionBadge: React.FC<Props> = ({ state, dias }) => {
  const sufijo =
    state === 'POR_VENCER' && dias !== null && dias !== undefined
      ? ` · ${dias}d`
      : state === 'VENCIDO' && dias !== null && dias !== undefined && dias < 0
        ? ` · hace ${Math.abs(dias)}d`
        : '';

  return (
    <Badge variant={VARIANTES[state]}>
      {BILLING_LABELS[state]}
      {sufijo}
    </Badge>
  );
};

export default SubscriptionBadge;
