import { useEffect, useState } from 'react'

function hitungSisa(selesai) {
  const sisa = new Date(selesai).getTime() - Date.now()
  return sisa > 0 ? sisa : 0
}

function Countdown({ selesai }) {
  const [sisa, setSisa] = useState(() => hitungSisa(selesai))

  useEffect(() => {
    const timer = setInterval(() => setSisa(hitungSisa(selesai)), 1000)
    return () => clearInterval(timer)
  }, [selesai])

  if (sisa === 0) return <span className="text-red-600 font-semibold">Berakhir</span>

  const jam = String(Math.floor(sisa / 3600000)).padStart(2, '0')
  const menit = String(Math.floor((sisa % 3600000) / 60000)).padStart(2, '0')
  const detik = String(Math.floor((sisa % 60000) / 1000)).padStart(2, '0')

  return <span className="font-mono font-semibold text-orange-600">{jam}:{menit}:{detik}</span>
}

export default Countdown