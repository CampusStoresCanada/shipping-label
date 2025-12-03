import { useState } from 'react'
import { STANDARD_BOX } from '@/lib/constants'

type BoxSelectorProps = {
  onContinue: (boxData: {
    type: 'standard' | 'custom'
    length: number
    width: number
    height: number
    weight: number
  }) => void
  onBack: () => void
}

export default function BoxSelector({ onContinue, onBack }: BoxSelectorProps) {
  const [weight, setWeight] = useState<string>('')
  const [error, setError] = useState('')

  const handleContinue = () => {
    setError('')

    if (!weight || parseFloat(weight) <= 0) {
      setError('Please enter a valid weight')
      return
    }

    onContinue({
      type: 'standard',
      length: STANDARD_BOX.length,
      width: STANDARD_BOX.width,
      height: STANDARD_BOX.height,
      weight: parseFloat(weight)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Package Details
        </h2>
        <p className="text-gray-600">
          Enter package weight (all packages use standard box)
        </p>
      </div>

      {/* Standard Box Display */}
      <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-900 text-lg mb-1">
              Standard Box
            </div>
            <div className="text-indigo-700 font-medium">
              {STANDARD_BOX.length}" × {STANDARD_BOX.width}" × {STANDARD_BOX.height}"
            </div>
            <div className="text-sm text-gray-600 mt-2">
              All conference shipments use this box size
            </div>
          </div>
          <div className="text-5xl">📦</div>
        </div>
      </div>

      {/* Weight */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Weight (lbs) *
        </label>
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Enter weight in pounds"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          Continue to Review
        </button>
      </div>
    </div>
  )
}
