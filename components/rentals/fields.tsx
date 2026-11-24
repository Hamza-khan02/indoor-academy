// Form fields for the bookings section's settings forms (used inside FormModal). Server-safe.
import {
  CATEGORIES, EQUIPMENT_CATEGORIES, EQUIPMENT_CONDITIONS, EQUIPMENT_PRICE_UNITS, PRICE_UNITS, RESOURCE_STATUS, SLOT_LENGTHS,
} from '@/lib/rentals/constants';
import { durationLabel, quarterHours } from '@/lib/rentals/time';

const TIMES = quarterHours();

export function TimeSelect({ name, value, optional }: { name: string; value?: number | null; optional?: boolean }) {
  return (
    <select name={name} defaultValue={value ?? (optional ? '' : 360)}>
      {optional && <option value="">Not set</option>}
      {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
  );
}

export function Check({ name, label, on, hint }: { name: string; label: string; on?: boolean; hint?: string }) {
  return (
    <label className="rn-check">
      <input type="checkbox" name={name} defaultChecked={on} />
      <span>{label}{hint && <small className="muted block">{hint}</small>}</span>
    </label>
  );
}

type Facility = {
  name: string; category: string; description: string | null; branchId: string | null; capacity: number;
  openTime: number; closeTime: number; slotMinutes: number; maxSlots: number; requiresApproval: boolean;
};

export function FacilityFields({ facility, branches }: { facility?: Facility; branches: { id: string; name: string }[] }) {
  return (
    <>
      <label>Name *<input name="name" required maxLength={60} defaultValue={facility?.name} placeholder="e.g. Indoor nets" /></label>
      <div className="form-row">
        {!facility && (
          <label>Type *
            <select name="category" defaultValue="NETS">
              {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
            </select>
          </label>
        )}
        <label>Branch
          <select name="branchId" defaultValue={facility?.branchId ?? ''}>
            <option value="">All / not tied to a branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        {!facility && <label>Number of units * <small className="muted">(nets, pitches, machines)</small><input name="units" type="number" min={1} max={20} defaultValue={1} required /></label>}
      </div>
      <label>Description (shown to customers)<textarea name="description" rows={2} maxLength={400} defaultValue={facility?.description ?? ''} /></label>
      <div className="form-row">
        <label>Opens at *<TimeSelect name="openTime" value={facility?.openTime ?? 360} /></label>
        <label>Closes at *<TimeSelect name="closeTime" value={facility?.closeTime ?? 1320} /></label>
      </div>
      <div className="form-row four">
        <label>Slot length *
          <select name="slotMinutes" defaultValue={facility?.slotMinutes ?? 60}>
            {SLOT_LENGTHS.map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
          </select>
        </label>
        <label>Longest booking (slots) *<input name="maxSlots" type="number" min={1} max={16} defaultValue={facility?.maxSlots ?? 4} required /></label>
        <label>Capacity (people) *<input name="capacity" type="number" min={1} max={200} defaultValue={facility?.capacity ?? 6} required /></label>
      </div>
      <Check name="requiresApproval" on={facility?.requiresApproval} label="Customer bookings need staff approval" hint="Off: bookings are confirmed (or wait for payment) straight away." />
      {!facility && <p className="form-hint">The equipment rental counter has no units: customers rent items from the Equipment list. New facilities start switched off: set the prices, then open it for booking.</p>}
    </>
  );
}

type Unit = { name: string; code: string; status: string; maintenanceNote: string | null; speedMin: number | null; speedMax: number | null; modes: string | null; notes: string | null };

export function ResourceFields({ unit, machine }: { unit?: Unit; machine: boolean }) {
  return (
    <>
      <div className="form-row">
        <label>Name *<input name="name" required maxLength={40} defaultValue={unit?.name} placeholder={machine ? 'e.g. Machine 1' : 'e.g. Net 3'} /></label>
        <label>Unique ID *<input name="code" required maxLength={20} defaultValue={unit?.code} placeholder={machine ? 'BM-03' : 'NET-03'} /></label>
      </div>
      {machine && (
        <>
          <div className="form-row">
            <label>Lowest speed (km/h)<input name="speedMin" type="number" min={20} max={200} defaultValue={unit?.speedMin ?? ''} /></label>
            <label>Highest speed (km/h)<input name="speedMax" type="number" min={20} max={200} defaultValue={unit?.speedMax ?? ''} /></label>
          </div>
          <label>Bowling modes <small className="muted">(if the machine has them, separated by commas)</small><input name="modes" maxLength={120} defaultValue={unit?.modes ?? ''} placeholder="Pace, Spin, Swing" /></label>
        </>
      )}
      <div className="form-row">
        <label>Status *
          <select name="status" defaultValue={unit?.status ?? 'ACTIVE'}>
            {Object.entries(RESOURCE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>Maintenance note<input name="maintenanceNote" maxLength={200} defaultValue={unit?.maintenanceNote ?? ''} placeholder="e.g. Motor being serviced" /></label>
      </div>
      <label>Notes (staff only)<input name="notes" maxLength={300} defaultValue={unit?.notes ?? ''} /></label>
    </>
  );
}

type Pricing = {
  unit: string; price: number; studentDiscountPct: number; peakStart: number | null; peakEnd: number | null; peakSurchargePct: number;
  weekendSurchargePct: number; securityDeposit: number; cancelFreeHours: number; cancelChargePct: number;
};

export function PricingFields({ pricing, equipmentOnly }: { pricing?: Pricing | null; equipmentOnly: boolean }) {
  return (
    <>
      {!equipmentOnly && (
        <div className="form-row">
          <label>Charged *
            <select name="unit" defaultValue={pricing?.unit ?? 'PER_HOUR'}>
              {Object.entries(PRICE_UNITS).filter(([k]) => k !== 'PER_ITEM').map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}
            </select>
          </label>
          <label>Price for outside customers (₹) *<input name="price" type="number" min={0} required defaultValue={pricing?.price ?? 0} /></label>
        </div>
      )}
      <div className="form-row">
        <label>Academy student discount (%)<input name="studentDiscountPct" type="number" min={0} max={100} defaultValue={pricing?.studentDiscountPct ?? 0} /></label>
        <label>Refundable security deposit (₹)<input name="securityDeposit" type="number" min={0} defaultValue={pricing?.securityDeposit ?? 0} /></label>
      </div>
      {!equipmentOnly && (
        <>
          <div className="form-row four">
            <label>Peak hours from<TimeSelect name="peakStart" value={pricing?.peakStart} optional /></label>
            <label>until<TimeSelect name="peakEnd" value={pricing?.peakEnd} optional /></label>
            <label>Peak extra (%)<input name="peakSurchargePct" type="number" min={0} max={300} defaultValue={pricing?.peakSurchargePct ?? 0} /></label>
            <label>Weekend extra (%)<input name="weekendSurchargePct" type="number" min={0} max={300} defaultValue={pricing?.weekendSurchargePct ?? 0} /></label>
          </div>
        </>
      )}
      <div className="form-row">
        <label>Free cancellation until (hours before)<input name="cancelFreeHours" type="number" min={0} max={720} defaultValue={pricing?.cancelFreeHours ?? 24} /></label>
        <label>Cancellation charge after that (%)<input name="cancelChargePct" type="number" min={0} max={100} defaultValue={pricing?.cancelChargePct ?? 0} /></label>
      </div>
      <p className="form-hint">{equipmentOnly ? 'Each equipment item has its own rental price in the Equipment list.' : 'Per session = one slot. Per day = the whole day is one booking.'} New prices apply to new bookings; existing bookings keep their price.</p>
    </>
  );
}

type Pkg = {
  name: string; description: string | null; includesNet: boolean; includesOperator: boolean; includesBalls: boolean; netFacilityId: string | null;
  pricePerUnit: number | null; operatorCharge: number; ballsCharge: number; active: boolean;
};

export function PackageFields({ pkg, nets, unitLabel }: { pkg?: Pkg; nets: { id: string; name: string }[]; unitLabel: string }) {
  return (
    <>
      <label>Package name *<input name="name" required maxLength={60} defaultValue={pkg?.name} /></label>
      <label>Description (shown to customers)<input name="description" maxLength={200} defaultValue={pkg?.description ?? ''} /></label>
      <div className="form-row">
        <label>Package price per {unitLabel} (₹) <small className="muted">(empty = the facility&apos;s normal price)</small><input name="pricePerUnit" type="number" min={0} defaultValue={pkg?.pricePerUnit ?? ''} /></label>
        <label>Net reserved from
          <select name="netFacilityId" defaultValue={pkg?.netFacilityId ?? ''}>
            <option value="">No net</option>
            {nets.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>Operator charge per {unitLabel} (₹)<input name="operatorCharge" type="number" min={0} defaultValue={pkg?.operatorCharge ?? 0} /></label>
        <label>Balls charge per booking (₹)<input name="ballsCharge" type="number" min={0} defaultValue={pkg?.ballsCharge ?? 0} /></label>
      </div>
      <Check name="includesNet" on={pkg?.includesNet} label="Includes a cricket net" hint="A free net is reserved together with the booking, or the booking is refused." />
      <Check name="includesOperator" on={pkg?.includesOperator} label="Includes an operator" />
      <Check name="includesBalls" on={pkg?.includesBalls} label="Includes balls" />
      <Check name="active" on={pkg?.active} label="Customers can book this package" />
    </>
  );
}

type Promo = {
  code: string; description: string | null; percentOff: number; amountOff: number; minAmount: number; validFrom: string | null; validTo: string | null;
  maxUses: number | null; facilityId: string | null; active: boolean;
};

export function PromoFields({ promo, facilities }: { promo?: Promo; facilities: { id: string; name: string }[] }) {
  return (
    <>
      <div className="form-row">
        <label>Code *<input name="code" required maxLength={20} defaultValue={promo?.code} placeholder="WELCOME10" style={{ textTransform: 'uppercase' }} /></label>
        <label>Only for facility
          <select name="facilityId" defaultValue={promo?.facilityId ?? ''}>
            <option value="">Any facility</option>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
      </div>
      <label>Description (staff only)<input name="description" maxLength={120} defaultValue={promo?.description ?? ''} /></label>
      <div className="form-row four">
        <label>Percent off<input name="percentOff" type="number" min={0} max={100} defaultValue={promo?.percentOff ?? 0} /></label>
        <label>Amount off (₹)<input name="amountOff" type="number" min={0} defaultValue={promo?.amountOff ?? 0} /></label>
        <label>Min. booking (₹)<input name="minAmount" type="number" min={0} defaultValue={promo?.minAmount ?? 0} /></label>
        <label>Uses allowed<input name="maxUses" type="number" min={1} defaultValue={promo?.maxUses ?? ''} placeholder="No limit" /></label>
      </div>
      <div className="form-row">
        <label>Valid from<input name="validFrom" type="date" defaultValue={promo?.validFrom ?? ''} /></label>
        <label>Valid until<input name="validTo" type="date" defaultValue={promo?.validTo ?? ''} /></label>
      </div>
      <Check name="active" on={promo ? promo.active : true} label="Code can be used" />
    </>
  );
}

type Item = { code: string; name: string; category: string; condition: string; rentalPrice: number; priceUnit: string; replacementCost: number; notes: string | null; active: boolean };

export function ItemFields({ item }: { item?: Item }) {
  return (
    <>
      <div className="form-row">
        <label>Name *<input name="name" required maxLength={60} defaultValue={item?.name} placeholder="e.g. English willow bat" /></label>
        <label>Equipment ID *<input name="code" required maxLength={20} defaultValue={item?.code} placeholder="BAT-01" /></label>
      </div>
      <div className="form-row">
        <label>Category *
          <select name="category" defaultValue={item?.category ?? 'BAT'}>
            {Object.entries(EQUIPMENT_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label>Condition *
          <select name="condition" defaultValue={item?.condition ?? 'GOOD'}>
            {Object.entries(EQUIPMENT_CONDITIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>Rental price (₹) *<input name="rentalPrice" type="number" min={0} required defaultValue={item?.rentalPrice ?? 0} /></label>
        <label>Charged *
          <select name="priceUnit" defaultValue={item?.priceUnit ?? 'PER_ITEM'}>
            {Object.entries(EQUIPMENT_PRICE_UNITS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        {!item && <label>Quantity in stock *<input name="totalQty" type="number" min={0} required defaultValue={1} /></label>}
        <label>Replacement cost (₹) <small className="muted">(guide for lost items)</small><input name="replacementCost" type="number" min={0} defaultValue={item?.replacementCost ?? 0} /></label>
      </div>
      <label>Notes<input name="notes" maxLength={300} defaultValue={item?.notes ?? ''} /></label>
      <Check name="active" on={item ? item.active : true} label="Can be rented" />
      {item && <p className="form-hint">To change the quantity, use &quot;Stock&quot; on the item: every change is recorded.</p>}
    </>
  );
}

export function BlockoutFields({ units, today }: { units: { id: string; name: string }[]; today: string }) {
  return (
    <>
      <div className="form-row">
        <label>Type *
          <select name="kind" defaultValue="MAINTENANCE">
            <option value="MAINTENANCE">Maintenance</option>
            <option value="BLOCKED">Blocked (event, holiday, private use)</option>
          </select>
        </label>
        <label>Unit
          <select name="resourceId" defaultValue="">
            <option value="">Every unit of this facility</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>From date *<input name="fromDate" type="date" required min={today} defaultValue={today} /></label>
        <label>To date <small className="muted">(empty = same day)</small><input name="toDate" type="date" min={today} /></label>
      </div>
      <Check name="allDay" on label="The whole day" hint="Untick to block only some hours of each day." />
      <div className="form-row">
        <label>From time<TimeSelect name="startMin" value={600} /></label>
        <label>To time<TimeSelect name="endMin" value={720} /></label>
      </div>
      <label>Reason (shown on the calendar)<input name="reason" maxLength={120} placeholder="e.g. Pitch relaying" /></label>
    </>
  );
}
