'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleRegister() {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Usuario creado')
    }
  }

  return (
    <div className="p-10 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold">Registro</h1>

      <input
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 w-full"
      />

      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 w-full"
      />

      <button
        onClick={handleRegister}
        className="bg-blue-600 text-white p-2 w-full"
      >
        Crear cuenta
      </button>
    </div>
  )
}