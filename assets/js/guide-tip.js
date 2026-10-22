(function(){
  "use strict";

  var API_URL =
    "https://mbw-shop-api.thecloudforestretreat.workers.dev/tips/checkout";
  var form = document.getElementById("guideTipForm");

  if(!form){
    return;
  }

  var language = form.getAttribute("data-language") === "es" ? "es" : "en";
  var guideSelect = document.getElementById("guideName");
  var otherField = document.getElementById("otherGuideField");
  var otherInput = document.getElementById("otherGuideName");
  var submitButton = document.getElementById("tipSubmit");
  var errorMessage = document.getElementById("tipError");
  var successMessage = document.getElementById("tipSuccess");
  var params = new URLSearchParams(window.location.search);

  function track(eventName, details){
    var payload = Object.assign({
      event:eventName,
      page_language:language,
      page_type:"guide_tip_page",
      payment_purpose:"guide_tip",
      currency:"USD"
    }, details || {});

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);

    if(typeof window.gtag === "function"){
      window.gtag("event", eventName, payload);
    }
  }

  function showMessage(element, message){
    errorMessage.classList.remove("is-visible");
    successMessage.classList.remove("is-visible");

    if(element){
      if(message){
        element.textContent = message;
      }
      element.classList.add("is-visible");
    }
  }

  function syncOtherGuide(){
    var showOther = guideSelect.value === "Other";
    otherField.hidden = !showOther;
    otherInput.required = showOther;

    if(!showOther){
      otherInput.value = "";
    }
  }

  guideSelect.addEventListener("change", syncOtherGuide);
  syncOtherGuide();

  if(params.get("status") === "success"){
    showMessage(
      successMessage,
      language === "es"
        ? "Gracias. Stripe confirmó tu pago. La propina se registrará por separado del pago del tour."
        : "Thank you. Stripe confirmed your payment. The tip will be recorded separately from the tour payment."
    );
    track("guide_tip_payment_return", {payment_status:"success"});
  }else if(params.get("status") === "cancelled"){
    showMessage(
      errorMessage,
      language === "es"
        ? "El pago fue cancelado. No se realizó ningún cargo."
        : "Payment was cancelled. No charge was made."
    );
    track("guide_tip_payment_return", {payment_status:"cancelled"});
  }

  form.addEventListener("submit", async function(event){
    event.preventDefault();

    if(!form.reportValidity()){
      return;
    }

    var amount = Number(document.getElementById("tipAmount").value);

    if(!Number.isFinite(amount) || amount < 1 || amount > 1000){
      showMessage(
        errorMessage,
        language === "es"
          ? "Ingresa una propina entre US$1 y US$1.000."
          : "Enter a tip between US$1 and US$1,000."
      );
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent =
      language === "es"
        ? "Abriendo Stripe…"
        : "Opening Stripe…";
    showMessage(null);

    track("guide_tip_checkout_start", {
      guide_name:guideSelect.value,
      value:amount
    });

    try{
      var response = await fetch(API_URL, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          amount:amount,
          guest_name:document.getElementById("guestName").value.trim(),
          customer_email:document.getElementById("guestEmail").value.trim(),
          guide_name:guideSelect.value,
          other_guide_name:otherInput.value.trim(),
          language:language
        })
      });
      var data = await response.json();

      if(!response.ok || !data.checkout_url){
        throw new Error(
          data.error ||
          (language === "es"
            ? "No fue posible iniciar el pago."
            : "Unable to start the payment.")
        );
      }

      window.location.assign(data.checkout_url);
    }catch(error){
      submitButton.disabled = false;
      submitButton.textContent =
        language === "es"
          ? "Continuar al pago seguro"
          : "Continue to Secure Payment";
      showMessage(
        errorMessage,
        error && error.message
          ? error.message
          : (language === "es"
            ? "Ocurrió un error. Inténtalo nuevamente."
            : "Something went wrong. Please try again.")
      );
      track("guide_tip_checkout_error");
    }
  });
})();
