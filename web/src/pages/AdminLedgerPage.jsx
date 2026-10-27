import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { displayName } from '../utils/displayName';
import { formatSyp } from '../utils/currency';

const STATEMENT_KIND_KEYS = {
  charge: 'statement.kindCharge',
  charge_reversal: 'statement.kindChargeReversal',
  payment: 'statement.kindPayment',
  payment_reversal: 'statement.kindPaymentReversal',
  return_credit: 'statement.kindReturnCredit',
  return_credit_reversal: 'statement.kindReturnCreditReversal',
  manual_credit: 'statement.kindManualCredit',
  manual_debit: 'statement.kindManualDebit',
  migration_adjustment: 'statement.kindMigrationAdjustment',
  opening_balance: 'statement.kindOpeningBalance',
};

function LedgerReference({ row }) {
  const { t } = useTranslation();
  const reference = row.reference ?? {};

  if (reference.invoiceNumber != null) {
    return (
      <>
        <div>{t('settlement.invoiceNumber', { number: reference.invoiceNumber })}</div>
        {reference.orderNumber != null && (
          <div className="adm-table-sub">{t('orders.orderNumber', { number: reference.orderNumber })}</div>
        )}
      </>
    );
  }
  if (reference.paymentNumber != null) {
    return (
      <>
        <div>{t('debts.paymentNumber', { number: reference.paymentNumber })}</div>
        {reference.method && (
          <div className="adm-table-sub">{t(`debts.method_${reference.method}`)}</div>
        )}
      </>
    );
  }
  return <span>{row.reason ?? '—'}</span>;
}

export function AdminLedgerPage() {
  const { t } = useTranslation();
  const [pharmacies, setPharmacies] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [pharmacyId, setPharmacyId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [statement, setStatement] = useState(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingStatement, setIsLoadingStatement] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.adminAccounts({ role: 'pharmacy', status: 'active', limit: 100 }),
      api.adminAccounts({ role: 'warehouse', status: 'active', limit: 100 }),
    ])
      .then(([pharmacyData, warehouseData]) => {
        if (!active) return;
        const nextPharmacies = pharmacyData.accounts
          .map((account) => account.pharmacy)
          .filter(Boolean);
        const nextWarehouses = warehouseData.accounts
          .map((account) => account.warehouse)
          .filter(Boolean);
        setPharmacies(nextPharmacies);
        setWarehouses(nextWarehouses);
        setPharmacyId(nextPharmacies[0]?.id ?? '');
        setWarehouseId(nextWarehouses[0]?.id ?? '');
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setIsLoadingAccounts(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pharmacyId || !warehouseId) {
      setStatement(null);
      return undefined;
    }
    let active = true;
    setError(null);
    setIsLoadingStatement(true);
    api
      .adminLedgerStatement(pharmacyId, warehouseId)
      .then((data) => {
        if (active) setStatement(data.statement);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setIsLoadingStatement(false);
      });
    return () => {
      active = false;
    };
  }, [pharmacyId, warehouseId]);

  return (
    <div>
      <div className="adm-page-head">
        <h1>{t('nav.ledger')}</h1>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="adm-card" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <label>
          {t('ledger.pharmacy')}
          <select value={pharmacyId} onChange={(event) => setPharmacyId(event.target.value)}>
            {pharmacies.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>
                {displayName(pharmacy.nameEn, pharmacy.nameAr)} ({pharmacy.phone})
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('ledger.warehouse')}
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {displayName(warehouse.nameEn, warehouse.nameAr)} ({warehouse.phone})
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoadingAccounts || isLoadingStatement ? (
        <p className="hint">{t('common.loading')}</p>
      ) : !pharmacies.length || !warehouses.length ? (
        <p className="hint">{t('ledger.noAccounts')}</p>
      ) : statement ? (
        <>
          <div className="adm-stats-grid">
            <div className="adm-card">
              <div className="adm-stat-label">{t('ledger.closingBalance')}</div>
              <strong>{formatSyp(statement.closing.syp)}</strong>
            </div>
            <div className="adm-card">
              <div className="adm-stat-label">{t('statement.charges')}</div>
              <strong>{formatSyp(statement.summary.chargesSyp)}</strong>
            </div>
            <div className="adm-card">
              <div className="adm-stat-label">{t('statement.payments')}</div>
              <strong>{formatSyp(statement.summary.paymentsSyp)}</strong>
            </div>
            <div className="adm-card">
              <div className="adm-stat-label">{t('statement.returnCredits')}</div>
              <strong>{formatSyp(statement.summary.returnCreditsSyp)}</strong>
            </div>
          </div>

          <div className="adm-card table-scroll">
            <h2 className="adm-detail-card-title">{t('statement.title')}</h2>
            {statement.rows.length === 0 ? (
              <p className="hint">{t('statement.empty')}</p>
            ) : (
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>{t('statement.date')}</th>
                    <th>{t('statement.type')}</th>
                    <th>{t('statement.reference')}</th>
                    <th className="adm-num">{t('statement.debit')}</th>
                    <th className="adm-num">{t('statement.credit')}</th>
                    <th className="adm-num">{t('statement.balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{new Date(row.effectiveAt).toLocaleString()}</td>
                      <td>{t(STATEMENT_KIND_KEYS[row.kind] ?? 'statement.kindOther')}</td>
                      <td>
                        <LedgerReference row={row} />
                      </td>
                      <td className="adm-num">{row.debitSyp ? formatSyp(row.debitSyp) : '—'}</td>
                      <td className="adm-num">{row.creditSyp ? formatSyp(row.creditSyp) : '—'}</td>
                      <td className="adm-num">{formatSyp(row.balanceSyp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
