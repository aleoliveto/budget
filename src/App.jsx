import React, { useEffect, useMemo, useState } from 'react'

const CATS = ["Housing","Food","Transport","Utilities","Health","Fun","Shopping","Other"]

const useLocal = (key, initial) => {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key)
      return v ? JSON.parse(v) : initial
    } catch { return initial }
  })
  useEffect(()=> localStorage.setItem(key, JSON.stringify(value)), [key, value])
  return [value, setValue]
}

const currency = (n) => (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'GBP' })

function App(){
  const [budget, setBudget] = useLocal('monthlyBudget', 0)
  const [txns, setTxns] = useLocal('txns', [])
  const [filterMonth, setFilterMonth] = useState(()=>{
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [sheetOpen, setSheetOpen] = useState(false)
  const monthTxns = useMemo(() => txns.filter(t => t.month === filterMonth), [txns, filterMonth])
  const spent = useMemo(() => monthTxns.filter(t => t.type==='expense').reduce((a,b)=>a+Number(b.amount||0),0), [monthTxns])
  const income = useMemo(() => monthTxns.filter(t => t.type==='income').reduce((a,b)=>a+Number(b.amount||0),0), [monthTxns])
  const remaining = (income || 0) + (budget || 0) - spent

  const setInitialBudgetIfEmpty = () => {
    if(!budget){ 
      const input = prompt("Set your monthly base budget (GBP):", "1000")
      const val = Number(input || 0)
      if(!Number.isNaN(val)) setBudget(val)
    }
  }
  useEffect(setInitialBudgetIfEmpty, [])

  const months = useMemo(()=> {
    const set = new Set(txns.map(t=>t.month))
    const now = new Date()
    set.add(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
    return Array.from(set).sort().reverse()
  }, [txns])

  return (
    <div className="app">
      <header className="header safe-top">
        <div className="title">Budget</div>
        <button className="icon-btn" aria-label="Add" onClick={()=>setSheetOpen(true)}>＋</button>
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
            const v = Number(prompt("Update monthly base budget (GBP):", String(budget || 0)))
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
            const catSpent = monthTxns.filter(t=>t.type==='expense' && t.cat===cat)
              .reduce((a,b)=>a+Number(b.amount||0),0)
            return (
              <div key={cat} className="catrow">
                <div>{cat}</div>
                <div>{currency(catSpent)}</div>
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
              <div className="amt">{t.type==='income' ? '+' : '-'}{currency(Number(t.amount||0))}</div>
              <button className="delete" onClick={()=> setTxns(txns.filter(x=>x.id!==t.id))}>✕</button>
            </li>
          ))}
          {!monthTxns.length && <li className="empty">No transactions yet.</li>}
        </ul>
      </section>

      {sheetOpen && (
        <AddSheet onClose={()=>setSheetOpen(false)} onAdd={(rec)=>{
          setTxns([...txns, rec]); setSheetOpen(false)
        }} defaultMonth={filterMonth} />
      )}

      <footer className="safe-bottom foot">
        <small>All data stored locally on your device.</small>
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

function AddSheet({onClose, onAdd, defaultMonth}){
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [cat, setCat] = useState('Other')
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10))

  const submit = (e)=>{
    e.preventDefault()
    const val = Number(amount)
    if(Number.isNaN(val) || val<=0) return alert('Enter a valid amount')
    const ts = new Date(date + "T12:00:00").getTime()
    const month = date.slice(0,7)
    onAdd({ id: crypto.randomUUID(), type, amount: val, note, cat, ts, month })
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

          <label>Category
            <select value={cat} onChange={e=>setCat(e.target.value)}>
              {CATS.map(c=> <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label>Note
            <input placeholder="e.g., Groceries" value={note} onChange={e=>setNote(e.target.value)} />
          </label>

          <label>Date
            <input type="date" value={date} onChange={e=>{ setDate(e.target.value) }} />
          </label>

          <button className="primary" type="submit">Save</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </form>
      </div>
    </div>
  )
}

export default App
