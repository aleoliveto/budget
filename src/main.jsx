import React, { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { useLocalStorage } from './hooks.js'

const CATS = ['Food', 'Transport', 'Entertainment', 'Utilities', 'Other']

function currency(val) {
  return val.toLocaleString(undefined, { style: 'currency', currency: 'GBP' })
}

function App() {
  const [budget, setBudget] = useLocalStorage('budget', 0)
  const [txns, setTxns] = useLocalStorage('txns', [])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [currentUser, setCurrentUser] = useLocalStorage('currentUser', 'Alessandro')
  const [catBudgetsMap, setCatBudgetsMap] = useLocalStorage('catBudgetsMap', {}) // { 'YYYY-MM': { Food: 240, ... } }
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'))

  const monthTxns = useMemo(() => txns.filter(t => t.month === filterMonth), [txns, filterMonth])
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

  const total = useMemo(() => txns.reduce((acc, t) => acc + t.amount, 0), [txns])

  return (
    <>
      <header className="header safe-top">
        <h1>Budget</h1>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={currentUser} onChange={e=>setCurrentUser(e.target.value)} className="icon-btn">
            <option>Anais</option>
            <option>Alessandro</option>
          </select>
          <button className="icon-btn" aria-label="Set Budgets" onClick={openBudgetSetter}>Set Budgets</button>
          <button className="icon-btn" aria-label="Add" onClick={()=>setSheetOpen(true)}>＋</button>
        </div>
      </header>
      <section className="catlist">
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
      </section>
      {sheetOpen && (
        <AddSheet
          onClose={() => setSheetOpen(false)}
          onAdd={item => {
            setTxns([...txns, item])
            setSheetOpen(false)
          }}
          defaultMonth={filterMonth}
          currentUser={currentUser}
        />
      )}
      <input ref={fileInputRef} type="file" accept="application/json" onChange={onImportFile} style={{ display:'none' }} />
    </>
  )
}

function AddSheet({onClose, onAdd, defaultMonth, currentUser}){
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [cat, setCat] = useState(CATS[0])
  const [month, setMonth] = useState(defaultMonth)
  const [who, setWho] = useState(currentUser || 'Alessandro')

  const submit = () => {
    const val = Number(amount)
    if (!val || val <= 0) return alert('Amount must be positive number')
    onAdd({ id: crypto.randomUUID(), type, amount: val, note, cat, ts: new Date().toISOString(), month, who })
  }

  return (
    <div className="sheet">
      <button onClick={onClose} aria-label="Close">×</button>
      <h2>Add Transaction</h2>
      <label>Type
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </label>
      <label>Amount
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
      </label>
      <label>Payer
        <select value={who} onChange={e=>setWho(e.target.value)}>
          <option value="Alessandro">Alessandro</option>
          <option value="Anais">Anais</option>
        </select>
      </label>
      <label>Category
        <select value={cat} onChange={e => setCat(e.target.value)}>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label>Note
        <input type="text" value={note} onChange={e => setNote(e.target.value)} />
      </label>
      <label>Month
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </label>
      <button onClick={submit}>Add</button>
    </div>
  )
}

export default App
