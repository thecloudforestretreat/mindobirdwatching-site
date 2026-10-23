(function(){
  "use strict";

  var API_URL =
    "https://mbw-shop-api.thecloudforestretreat.workers.dev/tips/checkout";
  var STATUS_URL =
    "https://mbw-shop-api.thecloudforestretreat.workers.dev/tips/session";
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
  var successView = document.getElementById("tipSuccessView");
  var successDetail = document.getElementById("tipSuccessDetail");
  var tipHero = document.getElementById("tipHero");
  var tipInfo = document.getElementById("tipInfo");

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

  function capitalizeName(value){
    return value.replace(
      /(^|[\s'-])([a-záéíóúüñ])/gi,
      function(match, separator, letter){
        return separator + letter.toLocaleUpperCase(language);
      }
    );
  }

  function applyNameCapitalization(input){
    input.addEventListener("blur", function(){
      input.value = capitalizeName(input.value.trim());
    });
  }

  function showSuccessView(data){
    var amount = Number(data.amount);
    var amountLabel = Number.isInteger(amount)
      ? "US$" + amount
      : "";
    var guideLabel = data.guide_name || "";

    successDetail.textContent = language === "es"
      ? "Tu propina de " + amountLabel + " para " + guideLabel + " fue pagada correctamente y quedó registrada por separado del pago del tour."
      : "Your " + amountLabel + " tip for " + guideLabel + " was paid successfully and recorded separately from your tour payment.";
    successView.hidden = false;
    tipHero.hidden = true;
    tipInfo.hidden = true;
    document.title = language === "es"
      ? "Propina Pagada | Mindo Bird Watching"
      : "Guide Tip Paid | Mindo Bird Watching";
    window.scrollTo({top:0,behavior:"smooth"});
  }

  async function verifySuccessfulPayment(sessionId){
    try{
      var response = await fetch(
        STATUS_URL + "?session_id=" + encodeURIComponent(sessionId)
      );
      var data = await response.json();

      if(!response.ok || !data.paid){
        throw new Error("Payment not verified");
      }

      showSuccessView(data);
      track("guide_tip_payment_return", {
        payment_status:"success",
        guide_name:data.guide_name,
        value:data.amount
      });
    }catch(error){
      showMessage(
        errorMessage,
        language === "es"
          ? "Recibimos el regreso de Stripe, pero no pudimos verificar el pago. Comunícate con Mindo Bird Watching antes de intentarlo nuevamente."
          : "Stripe returned you to this page, but we could not verify the payment. Contact Mindo Bird Watching before trying again."
      );
      track("guide_tip_payment_return", {payment_status:"verification_error"});
    }
  }

  guideSelect.addEventListener("change", syncOtherGuide);
  applyNameCapitalization(document.getElementById("guestName"));
  applyNameCapitalization(otherInput);
  syncOtherGuide();

  if(params.get("status") === "success" && params.get("session_id")){
    verifySuccessfulPayment(params.get("session_id"));
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

    if(!Number.isInteger(amount) || amount < 1 || amount > 1000){
      showMessage(
        errorMessage,
        language === "es"
          ? "Ingresa una propina en dólares enteros entre US$1 y US$1.000."
          : "Enter a whole-dollar tip between US$1 and US$1,000."
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
          guest_name:capitalizeName(document.getElementById("guestName").value.trim()),
          customer_email:document.getElementById("guestEmail").value.trim(),
          guide_name:guideSelect.value,
          other_guide_name:capitalizeName(otherInput.value.trim()),
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
