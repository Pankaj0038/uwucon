document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector("#form");
    const submitButton = document.querySelector("#submit");
    const scriptURL = '/purchase';

    form.addEventListener('submit', e => {
        submitButton.disabled = true;
        e.preventDefault(); 

        let requestBody = new FormData();  
        const name = form.querySelector('input[name="name"]');
        const contact = form.querySelector('input[name="contact"]');
        requestBody.append('name', name.value);
        requestBody.append('contact', contact.value);

        let posters = [];

        const checkboxes = form.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            posters.push(checkbox.name); 
        });

        requestBody.append('posters', JSON.stringify(posters));

        const fileInput = form.querySelector('input[type="file"]');
        const file = fileInput.files[0]; 

        if (file) {
            requestBody.append('file', file);
        }
        console.log(requestBody);

       // Make a POST request to the server
		fetch(scriptURL, {
		  method: 'POST',
		  body: requestBody, // your form data or payload
		})
		  .then(response => response.json()) // Assuming server sends a JSON response with the filename
		  .then(data => {
		    // Get the filename from the response
		    const filename = data.filename;

		    // Construct the redirect URL

		    let redirectURL = `/download?file=${filename}`;
		    console.log(redirectURL);
		    alert(redirectURL);
		    // Redirect to the download URL
		    // window.location.href = redirectURL;
		  })
		  .catch(error => {
		    console.error('Error during fetch:', error);
		  });

});


});
