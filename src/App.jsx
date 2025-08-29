import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// ------- Config & helpers -------
const CATS = [
  'Food', 'Transport', 'Housing', 'Utilities', 'Health', 'Fun', 'Shopping', 'Other'
]

// LocalStorage state hook
const useLocal = (key, initial) => {
  const [value, setValue] = useState(() => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : initial } catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)) } catch {} }, [key, value])
  return [value, setValue]
}

const currency = (n) => (Number(n) || 0).toLocaleString(undefined, { style: 'currency', currency: 'GBP' })

// Supabase client (env first, fallback to provided project)
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hnekyjpgcbmnqhqfhods.supabase.co'
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuZWt5anBnY2JtbnFocWZob2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNDgyOTEsImV4cCI6MjA2OTYyNDI5MX0.NvNgOQbOrwtO-wQ604LBE7tRh7-N775EnbBIC7gASYQ'
const supabase = createClient(SUPA_URL, SUPA_KEY)

// Single household (no prompt). Set via env VITE_HOUSEHOLD_ID or use default constant
const HOUSEHOLD_ID = (import.meta.env.VITE_HOUSEHOLD_ID || 'anais-alessandro').trim()

// ------- App -------
export default function App(){
  // base monthly budget (optional overall top-up)
  const [budget, setBudget] = useLocal('monthlyBudget', 0)
  // transactions
  const [txns, setTxns] = useLocal('txns', [])
  // month filter (YYYY-MM)
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  // UI: add sheet
  const [sheetOpen, setSheetOpen] = useState(false)
  // who is paying by default
  const [currentUser, setCurrentUser] = useLocal('currentUser', 'Alessandro')
  // per-month category budgets map
  const [catBudgetsMap, setCatBudgetsMap] = useLocal('catBudgetsMap', {})
  // default budgets applied when a month has none set
  const [defaultBudgets, setDefaultBudgets] = useLocal('defaultBudgets', {})
  // budget sheet modal
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false)

  // expanded categories UI state
  const [openCats, setOpenCats] = useState({})
  const toggleCat = (cat) => setOpenCats(prev => ({ ...prev, [cat]: !prev[cat] }))

  // derive data for current month
  const monthTxns = useMemo(() => txns.filter(t => t.month === filterMonth), [txns, filterMonth])
  const monthBudgets = useMemo(() => catBudgetsMap[filterMonth] || defaultBudgets || {}, [catBudgetsMap, defaultBudgets, filterMonth])
  const spent = useMemo(() => monthTxns.filter(t=>t.type==='expense').reduce((a,b)=>a+Number(b.amount||0),0), [monthTxns])
  const income = useMemo(() => monthTxns.filter(t=>t.type==='income').reduce((a,b)=>a+Number(b.amount||0),0), [monthTxns])
  const remaining = (income || 0) + (budget || 0) - spent

  // month picker: previous 12, current, next 12 + any from data
  const months = useMemo(() => {
    const set = new Set(txns.map(t=>t.month))
    const now = new Date()
    const addMonth = (y, m) => set.add(`${y}-${String(m).padStart(2,'0')}`)
    addMonth(now.getFullYear(), now.getMonth()+1)
    for (let i = -12; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      addMonth(d.getFullYear(), d.getMonth()+1)
    }
    return Array.from(set).sort().reverse()
  }, [txns])

  // --- Cloud sync: pull once, then auto push on changes ---
  const pulledOnce = useRef(false)
  useEffect(() => {
    if (!HOUSEHOLD_ID || pulledOnce.current) return
    pulledOnce.current = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('household_state')
          .select('data')
          .eq('household_id', HOUSEHOLD_ID)
          .single()
        if (!error && data?.data) {
          const d = data.data
          if (Array.isArray(d.txns)) setTxns(d.txns)
          if (d.catBudgetsMap && typeof d.catBudgetsMap === 'object') setCatBudgetsMap(d.catBudgetsMap)
          if (d.defaultBudgets && typeof d.defaultBudgets === 'object') setDefaultBudgets(d.defaultBudgets)
          if (typeof d.monthlyBudget === 'number') setBudget(d.monthlyBudget)
        }
      } catch { /* no-op */ }
    })()
  }, [])

  useEffect(() => {
    if (!HOUSEHOLD_ID) return
    const payload = { txns, catBudgetsMap, defaultBudgets, monthlyBudget: budget }
    const t = setTimeout(async () => {
      try {
        await supabase.from('household_state').upsert({
          household_id: HOUSEHOLD_ID,
          data: payload,
          updated_at: new Date().toISOString()
        })
      } catch { /* no-op */ }
    }, 500)
    return () => clearTimeout(t)
  }, [txns, catBudgetsMap, defaultBudgets, budget])

  // ------- UI -------
  return (
    <div className="app">
      <header className="header safe-top">
        <div className="title">Budget Alessandro & Patatina</div>
        <div className="subheader">
          <select value={currentUser} onChange={e=>setCurrentUser(e.target.value)} className="icon-btn">
            <option>Anais</option>
            <option>Alessandro</option>
          </select>
          <button className="icon-btn" onClick={()=> setBudgetSheetOpen(true)}>Set Budgets</button>
          <button className="icon-btn" aria-label="Add" onClick={()=>setSheetOpen(true)}>＋</button>
        </div>
      </header>

      <section className="summary">
        <div className="row">
          <div className="pill">
            <div className="label">Month</div>
            <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="pill clickable" onClick={()=>{
            const v = Number(prompt('Update monthly base budget (GBP):', String(budget || 0)))
            if(!Number.isNaN(v)) setBudget(v)
          }}>
            <div className="label">Base Budget</div>
            <div className="value">{currency(budget)}</div>
          </div>
        </div>

        <div className="cards">
          <Card label="Income" value={currency(income)} />
          <Card label="Spent" value={currency(spent)} />
          <Card label="Remaining" value={currency(remaining)} intent={remaining>=0?'ok':'warn'} />
        </div>
      </section>

      <section className="bycat">
        <h3>By Category</h3>
        <div className="catlist">
          {CATS.map(cat=>{
            const catItems = monthTxns.filter(t=>t.type==='expense' && t.cat===cat)
            const catSpent = catItems.reduce((a,b)=>a+Number(b.amount||0),0)
            const cap = Number(monthBudgets[cat]||0)
            const remainingCat = cap ? cap - catSpent : null
            const open = !!openCats[cat]
            return (
              <div key={cat} className="catrow" onClick={()=>toggleCat(cat)}>
                <div style={{display:'flex', flexDirection:'column'}}>
                  <div>{cat}</div>
                  {cap ? (
                    <>
                      <small className="muted">Budget {currency(cap)} • Remaining {currency(remainingCat)}</small>
                      <div className="progress"><div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, (catSpent/cap)*100))}%` }} /></div>
                    </>
                  ) : <small className="muted">No budget set</small>}
                </div>
                <div>{currency(catSpent)}</div>
                {open && (
                  <div style={{gridColumn:'1 / -1', marginTop:8, width:'100%'}}>
                    {catItems.length ? (
                      <ul style={{margin:0, paddingLeft:16}}>
                        {catItems.map(it=> (
                          <li key={it.id} style={{marginBottom:4}}>
                            {(it.who||'Someone')} has paid {currency(it.amount)} on {new Date(it.ts).toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    ) : <small className="muted">No expenses yet.</small>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="txns">
        <h3>Transactions</h3>
        <ul className="list">
          {monthTxns.sort((a,b)=>b.ts-a.ts).map(t=>(
            <li key={t.id} className={`item ${t.type}`}>
              <div className="main">
                <div className="name">{t.note || (t.type==='income'?'Income':'Expense')}</div>
                <div className="meta">{t.cat} • {new Date(t.ts).toLocaleDateString()}</div>
              </div>
              <div className="amt">{t.type==='income' ? '+' : '-'}{currency(t.amount)}</div>
              <button className="delete" onClick={()=> setTxns(txns.filter(x=>x.id!==t.id))}>✕</button>
            </li>
          ))}
          {!monthTxns.length && <li className="empty">No transactions yet.</li>}
        </ul>
      </section>

      {sheetOpen && (
        <AddSheet
          onClose={()=>setSheetOpen(false)}
          onAdd={(rec)=>{ setTxns([...txns, rec]); setSheetOpen(false) }}
          defaultMonth={filterMonth}
          currentUser={currentUser}
        />
      )}

      {budgetSheetOpen && (
        <BudgetSheet
          open={budgetSheetOpen}
          onClose={()=> setBudgetSheetOpen(false)}
          initial={monthBudgets}
          monthLabel={filterMonth}
          onSave={(vals, opts)=>{
            setCatBudgetsMap({ ...catBudgetsMap, [filterMonth]: vals })
            if (opts?.applyDefault) setDefaultBudgets(vals)
            setBudgetSheetOpen(false)
          }}
        />
      )}

      <footer className="safe-bottom foot">
        <small>Synced to cloud automatically.</small>
      </footer>
    </div>
  )
}

function Card({label, value, intent}){
  return (
    <div className={`card ${intent||''}`}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
    </div>
  )
}

function AddSheet({onClose, onAdd, defaultMonth, currentUser}){
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [cat, setCat] = useState('Other')
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10))
  const [who, setWho] = useState(currentUser || 'Alessandro')

  const submit = (e)=>{
    e.preventDefault()
    const val = Number(amount)
    if(Number.isNaN(val) || val<=0) return alert('Enter a valid amount')
    const ts = new Date(date + 'T12:00:00').getTime()
    const month = date.slice(0,7)
    onAdd({ id: crypto.randomUUID(), type, amount: val, note, cat, ts, month, who })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="sheet-bar" />
        <h3>Add transaction</h3>
        <form onSubmit={submit} className="form">
          <div className="segmented">
            <button type="button" className={type==='expense'?'active':''} onClick={()=>setType('expense')}>Expense</button>
            <button type="button" className={type==='income'?'active':''} onClick={()=>setType('income')}>Income</button>
          </div>
          <label>Amount
            <input inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} />
          </label>
          <label>Payer
            <select value={who} onChange={e=>setWho(e.target.value)}>
              <option value="Alessandro">Alessandro</option>
              <option value="Anais">Anais</option>
            </select>
          </label>
          <label>Category
            <select value={cat} onChange={e=>setCat(e.target.value)}>
              {CATS.map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Note
            <input placeholder="e.g., Groceries" value={note} onChange={e=>setNote(e.target.value)} />
          </label>
          <label>Date
            <input type="date" value={date} onChange={e=> setDate(e.target.value)} />
          </label>
          <div style={{display:'flex', gap:8}}>
            <button className="primary" type="submit">Save</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BudgetSheet({ open, onClose, initial, onSave, monthLabel }){
  const [values, setValues] = useState(()=> ({ ...initial }))
  const [applyDefault, setApplyDefault] = useState(true)

  useEffect(()=>{ setValues({ ...initial }) }, [initial])

  const update = (cat, val) => {
    const num = Number(val)
    setValues(v => ({ ...v, [cat]: Number.isNaN(num) ? 0 : num }))
  }

  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="sheet-bar" />
        <h3>Set budgets for {monthLabel}</h3>
        <div className="form" style={{maxHeight: '60vh', overflow:'auto'}}>
          {CATS.map(c => (
            <label key={c}>{c}
              <input inputMode="decimal" placeholder="0.00" value={values[c] ?? ''} onChange={e=>update(c, e.target.value)} />
            </label>
          ))}
          <label style={{flexDirection:'row', alignItems:'center', gap:8}}>
            <input type="checkbox" checked={applyDefault} onChange={e=>setApplyDefault(e.target.checked)} />
            Also save as default for other months
          </label>
          <div style={{display:'flex', gap:8}}>
            <button className="primary" onClick={()=> onSave(values, { applyDefault })}>Save</button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
