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
    $('button[rel="create"]').click(function() {
        makeRequest('POST', '/spreadsheets', function(err, spreadsheet) {
            if (err) return showError(err);
            window.location.reload();
        });
    });
    $('button[rel="sync"]').click(function() {
        let spreadsheetId = $(this).data('spreadsheetid');
        let url = '/spreadsheets/' + spreadsheetId + '/sync';
        makeRequest('POST', url, function(err) {
            if (err) return showError(err);
            showMessage('Sync complete.')
        });
    });
    $('button[rel="import"]').click(function() {
        let url ='http://localhost:3000/import';
        /*let headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Accept', 'application/json');
        let options = {
            headers:headers,
            Method: 'GET'
        };*/

         $('button[rel="import"]').hidden = true;
          $(".progress")[0].hidden = false;
         setSpinnerActive(true);
         $.ajax({url: url, success: function(result){
                 console.log(result);
                 $('button[rel="import"]').hidden = false;
                 $(".progress")[0].hidden = true;
                 setSpinnerActive(false);
                 if(result.order.length == 0 && result.error.length == 0){
                     showMessage('No Orders has been  import');
                 }
                 else if(result.order.length > 1 && result.error.length == 0){
                     showMessage('All Orders has been import');
                 }
                 else if(result.order.length == 0 && result.error.length > 1){
                     showMessage('No Orders has been  import');
                     setTimeout(function () {
                         showError('Some orders has failed to import');
                     },1000);
                 }
                 else if(result.order.length > 1 && result.error.length > 1){
                     showMessage('Some Orders has been import');
                     setTimeout(function () {
                         showError('Some orders has failed to import');
                     },1000);


                 }
             }});
        /*    fetch(url, options).then(response=>{
                    $(".progress")[0].hidden = true;
                    setSpinnerActive(true);
                }
            ).then(response=>{
                    $(".progress")[0].hidden = true;
                }
            ).
            catch(err=>console.error(err))*/
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
    let snackbar = $('#snackbar');
    snackbar.addClass('error');
    snackbar.get(0).MaterialSnackbar.showSnackbar(error);
}

function showMessage(message) {
    let snackbar = $('#snackbar');
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
    // let id_token = user.getAuthResponse().id_token;
    // let xhr = new XMLHttpRequest();
    // xhr.open('POST','http://208.104.17.253:6776/api/v1/tokensiginonserver');
    // xhr.open('POST','http://208.104.17.253:3000/tokensiginonserver');
    // xhr.setRequestHeader('x-token',id_token);
    // xhr.onload = function(){
    //     console.log(`Server response :  ${xhr.responseText}`);
    // };
    // xhr.send('idtoken='+id_token);
}
function signOut() {
    document.getElementById('logoutButton').hidden = true;
    let auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
        console.log('User signed out.');
    });

}

