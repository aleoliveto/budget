import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

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

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hnekyjpgcbmnqhqfhods.supabase.co'
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuZWt5anBnY2JtbnFocWZob2RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwNDgyOTEsImV4cCI6MjA2OTYyNDI5MX0.NvNgOQbOrwtO-wQ604LBE7tRh7-N775EnbBIC7gASYQ'
const supabase = createClient(SUPA_URL, SUPA_KEY)

function App(){
  const [budget, setBudget] = useLocal('monthlyBudget', 0)
  const [txns, setTxns] = useLocal('txns', [])
  const [filterMonth, setFilterMonth] = useState(()=>{
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [sheetOpen, setSheetOpen] = useState(false)

  const [currentUser, setCurrentUser] = useLocal('currentUser', 'Alessandro')
  const [catBudgetsMap, setCatBudgetsMap] = useLocal('catBudgetsMap', {}) // { 'YYYY-MM': { Food: 240, ... } }

  const monthBudgets = useMemo(() => catBudgetsMap[filterMonth] || {}, [catBudgetsMap, filterMonth])

  const openBudgetSetter = () => {
    const next = { ...monthBudgets }
    for (const c of CATS) {
      const val = prompt(`Monthly budget for ${c} (GBP)`, String(next[c] ?? ''))
      if (val === null) continue
      const num = Number(val)
      if (!Number.isNaN(num)) next[c] = num
    }
    setCatBudgetsMap({ ...catBudgetsMap, [filterMonth]: next })
  }

  const fileInputRef = useRef(null)

  const exportData = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      budget,
      txns
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `budget-export-${new Date().toISOString().slice(0,10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const triggerImport = () => fileInputRef.current?.click()

  const onImportFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (typeof data !== 'object' || data === null) throw new Error('Invalid file')
        if (Array.isArray(data.txns)) setTxns(data.txns)
        if (typeof data.budget === 'number') setBudget(data.budget)
        alert('Import completed successfully')
      } catch (err) {
        alert('Import failed: ' + err.message)
      } finally {
        e.target.value = '' // reset so the same file can be re-selected
      }
    }
    reader.readAsText(file)
  }

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
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={currentUser} onChange={e=>setCurrentUser(e.target.value)} className="icon-btn">
            <option>Anais</option>
            <option>Alessandro</option>
          </select>
          <button className="icon-btn" aria-label="Set Budgets" onClick={openBudgetSetter}>Set Budgets</button>
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
            const catItems = monthTxns.filter(t=>t.type==='expense' && t.cat===cat)
            const catSpent = catItems.reduce((a,b)=>a+Number(b.amount||0),0)
            const cap = Number(monthBudgets[cat]||0)
            const remainingCat = cap ? cap - catSpent : null
            const [open, setOpen] = useState(false)
            return (
              <div key={cat} className="catrow" onClick={()=>setOpen(!open)}>
                <div style={{display:'flex', flexDirection:'column'}}>
                  <div>{cat}</div>
                  {cap ? <small className="muted">Budget {cap.toLocaleString(undefined,{style:'currency',currency:'GBP'})} • Remaining {remainingCat.toLocaleString(undefined,{style:'currency',currency:'GBP'})}</small> : <small className="muted">No budget set</small>}
                </div>
                <div>{currency(catSpent)}</div>
                {open && (
                  <div style={{gridColumn:'1 / -1', marginTop:8, width:'100%'}}>
                    {catItems.length ? (
                      <ul style={{margin:0, paddingLeft:16}}>
                        {catItems.map(it=> (
                          <li key={it.id} style={{marginBottom:4}}>
                            {it.who || 'Someone'} has paid {currency(Number(it.amount||0))} on {new Date(it.ts).toLocaleString()}
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
        }} defaultMonth={filterMonth} currentUser={currentUser} />
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
    const ts = new Date(date + "T12:00:00").getTime()
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
