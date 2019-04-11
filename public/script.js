/*
  Copyright 2016 Google, Inc.

  Licensed to the Apache Software Foundation (ASF) under one or more contributor
  license agreements. See the NOTICE file distributed with this work for
  additional information regarding copyright ownership. The ASF licenses this
  file to you under the Apache License, Version 2.0 (the "License"); you may not
  use this file except in compliance with the License. You may obtain a copy of
  the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
  WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
  License for the specific language governing permissions and limitations under
  the License.
*/

// Bind handlers when the page loads.

$(function() {
    $('a.mdl-button').click(function() {
        setSpinnerActive(true);
    });
    //onGooglePayLoaded();
    $('button[rel="create"]').click(function() {
        makeRequest('POST', '/spreadsheets', function(err, spreadsheet) {
            if (err) return showError(err);
            window.location.reload();
        });
    });
    $('button[rel="sync"]').click(function() {
        var spreadsheetId = $(this).data('spreadsheetid');
        var url = '/spreadsheets/' + spreadsheetId + '/sync';
        makeRequest('POST', url, function(err) {
            if (err) return showError(err);
            showMessage('Sync complete.')
        });
    });

});

function setSpinnerActive(isActive) {
    if (isActive) {
        $('#spinner').addClass('is-active');
    } else {
        $('#spinner').removeClass('is-active');
    }
}

function showError(error) {
    console.log(error);
    var snackbar = $('#snackbar');
    snackbar.addClass('error');
    snackbar.get(0).MaterialSnackbar.showSnackbar(error);
}

function showMessage(message) {
    var snackbar = $('#snackbar');
    snackbar.removeClass('error');
    snackbar.get(0).MaterialSnackbar.showSnackbar({
        message: message
    });
}
// Spreadsheet control handlers.


function makeRequest(method, url, callback) {
    let auth = gapi.auth2.getAuthInstance();
    if (!auth.isSignedIn.get()) {
        return callback(new Error('Signin required.'));
    }
    let accessToken = auth.currentUser.get().getAuthResponse().access_token;
    setSpinnerActive(true);
    $.ajax(url, {
        method: method,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        },
        success: function(response) {
            setSpinnerActive(false);
            return callback(null, response);
        },
        error: function(response) {
            setSpinnerActive(false);
            return callback(new Error(response.responseJSON.message));
        }
    });
}
function onSignIn(user) {
    let profile = user.getBasicProfile();
    $('#profile .name').text(profile.getName());
    $('#profile .email').text(profile.getEmail());
    // console.log('ID: ' + profile.getId());
    console.log('Full Name: ' + profile.getName());
    // console.log('Given Name: ' + profile.getGivenName());
    // console.log('Family Name: ' + profile.getFamilyName());
    // console.log('Image URL: ' + profile.getImageUrl());
    document.getElementById('logoutButton').hidden = false;
    // $('logoutButton').hidden= true;
    // console.log('Email: ' + profile.getEmail());
    let id_token = user.getAuthResponse().id_token;
    let xhr = new XMLHttpRequest();
    // xhr.open('POST','http://208.104.17.253:6776/api/v1/tokensiginonserver');
    xhr.open('POST','http://208.104.17.253:3000/tokensiginonserver');
    xhr.setRequestHeader('x-token',id_token);
    xhr.onload = function(){
        console.log(`Server response :  ${xhr.responseText}`);
    };
    xhr.send('idtoken='+id_token);
}
function signOut() {
    document.getElementById('logoutButton').hidden = true;
    let auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
        console.log('User signed out.');
    });
    /**
     * Payment methods accepted by your gateway
     *
     * @todo confirm support for both payment methods with your gateway
     */
    var allowedPaymentMethods = ['CARD', 'TOKENIZED_CARD'];

    /**
     * Card networks supported by your site and your gateway
     *
     * @see {@link https://developers.google.com/pay/api/web/object-reference#CardRequirements|CardRequirements}
     * @todo confirm card networks supported by your site and gateway
     */
    var allowedCardNetworks = ['AMEX', 'DISCOVER', 'JCB', 'MASTERCARD', 'VISA'];

    /**
     * Identify your gateway and your site's gateway merchant identifier
     *
     * The Google Pay API response will return an encrypted payment method capable of
     * being charged by a supported gateway after shopper authorization
     *
     * @todo check with your gateway on the parameters to pass
     * @see {@link https://developers.google.com/pay/api/web/object-reference#Gateway|PaymentMethodTokenizationParameters}
     */
    var tokenizationParameters = {
        tokenizationType: 'PAYMENT_GATEWAY',
        parameters: {
            'gateway': 'example',
            'gatewayMerchantId': 'abc123'
        }
    }

    /**
     * Initialize a Google Pay API client
     *
     * @returns {google.payments.api.PaymentsClient} Google Pay API client
     */
    function getGooglePaymentsClient() {
        return (new google.payments.api.PaymentsClient({environment: 'TEST'}));
    }

    /**
     * Initialize Google PaymentsClient after Google-hosted JavaScript has loaded
     */
    function onGooglePayLoaded() {
        var paymentsClient = getGooglePaymentsClient();
        paymentsClient.isReadyToPay({allowedPaymentMethods: allowedPaymentMethods})
            .then(function(response) {
                if (response.result) {
                    addGooglePayButton();
                    prefetchGooglePaymentData();
                }
            })
            .catch(function(err) {
                // show error in developer console for debugging
                console.error(err);
            });
    }

    /**
     * Add a Google Pay purchase button alongside an existing checkout button
     *
     * @see {@link https://developers.google.com/pay/api/brand-guidelines|Google Pay brand guidelines}
     */
    function addGooglePayButton() {
        var button = document.createElement('button');
        // identify the element to apply Google Pay branding in related CSS
        button.className = 'google-pay';
        button.appendChild(document.createTextNode('Google Pay'));
        button.addEventListener('click', onGooglePaymentButtonClicked);
        document.getElementById('container').appendChild(button);
    }

    /**
     * Configure support for the Google Pay API
     *
     * @see {@link https://developers.google.com/pay/api/web/object-reference#PaymentDataRequest|PaymentDataRequest}
     * @returns {object} PaymentDataRequest fields
     */
    function getGooglePaymentDataConfiguration() {
        return {
            // @todo a merchant ID is available for a production environment after approval by Google
            // @see {@link https://developers.google.com/pay/api/web/test-and-deploy|Test and deploy}
            merchantId: '01234567890123456789',
            paymentMethodTokenizationParameters: tokenizationParameters,
            allowedPaymentMethods: allowedPaymentMethods,
            cardRequirements: {
                allowedCardNetworks: allowedCardNetworks
            }
        };
    }

    /**
     * Provide Google Pay API with a payment amount, currency, and amount status
     *
     * @see {@link https://developers.google.com/pay/api/web/object-reference#TransactionInfo|TransactionInfo}
     * @returns {object} transaction info, suitable for use as transactionInfo property of PaymentDataRequest
     */
    function getGoogleTransactionInfo() {
        return {
            currencyCode: 'USD',
            totalPriceStatus: 'FINAL',
            // set to cart total
            totalPrice: '1.00'
        };
    }

    /**
     * Prefetch payment data to improve performance
     */
    function prefetchGooglePaymentData() {
        var paymentDataRequest = getGooglePaymentDataConfiguration();
        // transactionInfo must be set but does not affect cache
        paymentDataRequest.transactionInfo = {
            totalPriceStatus: 'NOT_CURRENTLY_KNOWN',
            currencyCode: 'USD'
        };
        var paymentsClient = getGooglePaymentsClient();
        paymentsClient.prefetchPaymentData(paymentDataRequest);
    }

    /**
     * Show Google Pay chooser when Google Pay purchase button is clicked
     */
    function onGooglePaymentButtonClicked() {
        var paymentDataRequest = getGooglePaymentDataConfiguration();
        paymentDataRequest.transactionInfo = getGoogleTransactionInfo();

        var paymentsClient = getGooglePaymentsClient();
        paymentsClient.loadPaymentData(paymentDataRequest)
            .then(function(paymentData) {
                // handle the response
                processPayment(paymentData);
            })
            .catch(function(err) {
                // show error in developer console for debugging
                console.error(err);
            });
    }

    /**
     * Process payment data returned by the Google Pay API
     *
     * @param {object} paymentData response from Google Pay API after shopper approves payment
     * @see {@link https://developers.google.com/pay/api/web/object-reference#PaymentData|PaymentData object reference}
     */
    function processPayment(paymentData) {
        // show returned data in developer console for debugging
        console.log(paymentData);
        // @todo pass payment data response to gateway to process payment
    }
}

