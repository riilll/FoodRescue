function Toast({ pesan, tipe, onTutup }) {
  if (!pesan) return null
  const warna = tipe === 'sukses' ? 'bg-green-600' : 'bg-red-600'
  return (
    <div className={`fixed bottom-4 right-4 ${warna} text-white rounded-lg shadow-lg px-4 py-3 max-w-sm`}>
      <div className="flex items-start gap-3">
        <p className="text-sm">{pesan}</p>
        <button onClick={onTutup} className="font-bold">×</button>
      </div>
    </div>
  )
}

export default Toast