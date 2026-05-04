'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    } else {
      router.push('/clientes/nuevo')
    }
  }

  return (
    <div className="p-10 max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold">Login</h1>

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
        onClick={handleLogin}
        className="bg-green-600 text-white p-2 w-full"
      >
        Ingresar
      </button>
    </div>
  )
}