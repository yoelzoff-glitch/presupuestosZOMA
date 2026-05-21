import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { name, email, message } = await request.json()

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 })
    }

    // En un entorno de producción real, aquí se usaría un servicio como Resend, SendGrid o nodemailer
    // para enviar el correo a soporte@zoma.com.ar.
    // También se podría registrar la consulta en la base de datos si existiera una tabla dedicada.
    console.log('\n=================== 📨 NUEVA CONSULTA DE CONTACTO (ZOMA) ===================')
    console.log(`👤 Nombre: ${name}`)
    console.log(`📧 Email:  ${email}`)
    console.log(`💬 Mensaje:\n${message}`)
    console.log('============================================================================\n')

    return NextResponse.json({
      success: true,
      message: 'Consulta recibida correctamente. Nos comunicaremos a la brevedad.'
    })
  } catch (error: any) {
    console.error('Error en API de contacto:', error)
    return NextResponse.json({ error: 'Ocurrió un error al procesar tu consulta' }, { status: 500 })
  }
}
