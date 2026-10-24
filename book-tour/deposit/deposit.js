(() => {
  const params = new URLSearchParams(location.search), es = params.get('lang') === 'es';
  const inquiry = params.get('inquiry_id') || params.get('client_reference_id') || '';
  const sandbox = params.get('env') === 'sandbox', button = document.getElementById('continue'), status = document.getElementById('status');
  const api = '/stripe/api/';
  document.getElementById('sandbox').hidden = !sandbox;
  if (es) {
    document.documentElement.lang = 'es'; document.title = 'Depósito de reserva | Mindo Bird Watching';
    const copy = {title:'Depósito de reserva del tour',description:'El depósito se descuenta del precio total de tu reserva. Realiza el pago después de que nuestro equipo confirme los detalles del tour.',currency:'El cobro se realiza en dólares estadounidenses. La conversión de moneda de Stripe está desactivada.',billing:'Todos los pagos se facturan a nombre de Mindo Bird Watching.',contact:'Contacta a nuestro equipo',terms:'Términos del servicio',privacy:'Política de privacidad',sandbox:'Prueba en sandbox: sin pago real ni registros en el CRM o la contabilidad de producción.'};
    for (const [id,text] of Object.entries(copy)) document.getElementById(id).textContent = text;
    button.textContent = 'Continuar al pago seguro';
  }
  const fail = es ? 'No pudimos abrir el pago. Contacta a nuestro equipo antes de volver a intentarlo.' : 'We could not open checkout. Please contact our team before trying again.';
  const session = params.get('session_id');
  if (session) {
    button.hidden = true;
    status.textContent = es ? 'Verificando el estado del pago…' : 'Checking payment status…';
    fetch(api+'deposit-session?session_id='+encodeURIComponent(session),{cache:'no-store'}).then(r=>r.json()).then(data=>{
      if (!data.ok) throw Error();
      if (data.sandbox && data.payment_status === 'paid') {
        status.textContent = es ? 'Pago de prueba confirmado por Stripe: $100 USD. No se movieron fondos reales ni se crearon registros de producción.' : 'Stripe confirmed the $100 USD sandbox payment. No real funds moved and no production records were created.';
        return;
      }
      status.textContent = data.payment_status === 'paid' ? (es ? 'Stripe confirmó tu depósito de $100 USD. Conserva el recibo que recibirás por correo.' : 'Stripe confirmed your $100 USD deposit. Please keep the receipt sent by email.') : (es ? 'Stripe aún no ha confirmado el pago. Contacta a nuestro equipo antes de pagar de nuevo.' : 'Stripe has not confirmed payment yet. Contact our team before paying again.');
    }).catch(()=>{status.textContent=es?'No podemos verificar el pago todavía. Revisa tu recibo de Stripe o contacta a nuestro equipo.':'We cannot verify payment yet. Check your Stripe receipt or contact our team.';});
    return;
  }
  if (!/^INQ-[A-Za-z0-9_-]+$/.test(inquiry)) {
    button.hidden = true; status.textContent = es ? 'Solicita a nuestro equipo un enlace de depósito vinculado a tu reserva.' : 'Please ask our team for a deposit link connected to your inquiry.'; return;
  }
  button.addEventListener('click',async()=>{
    button.disabled=true; status.textContent=es?'Abriendo Stripe…':'Opening Stripe…';
    try {
      const response=await fetch(api+'create-deposit-session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({inquiry_id:inquiry,language:es?'es':'en',brand_id:params.get('brand')||'mbw',stripe_environment:sandbox?'sandbox':'live'})});
      const data=await response.json();
      if (!response.ok || !data.ok || !data.url) throw Error();
      const checkout=new URL(data.url); if(checkout.protocol!=='https:' || checkout.hostname!=='checkout.stripe.com') throw Error();
      location.assign(checkout.toString());
    } catch { status.textContent=fail; button.disabled=false; }
  });
})();
