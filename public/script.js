document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector("#form");
    const submitButton = document.querySelector("#submit");
    const scriptURL = '/';

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

        fetch(scriptURL, { method: 'POST', body: requestBody })
            .then(response => response.json()) 
            .then(data => {
                alert('Success! ' + data.message); 
                submitButton.disabled = false; 
            })
            .catch(error => {
                alert('Error! ' + error.message);
                submitButton.disabled = false; 
    });
});
});
