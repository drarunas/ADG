function init_advanced_search() {

    document.getElementById('advancedSearchForm').addEventListener('submit', function (event) {
        event.preventDefault();
        advSearchSubmitEvent();

    });
}

let currentAbortController_search = null;
function advSearchSubmitEvent() {
    // Abort any ongoing fetches if a new submission is made
    if (currentAbortController_search) {
        currentAbortController_search.abort();
    }

    // Create a new AbortController instance for the current submission
    currentAbortController_search = new AbortController();
    const { signal } = currentAbortController_search;
    $('#adv_search_results').empty();
    const spinner = `
    <div class="d-flex justify-content-center text-primary" id="loading-spinner">
        <div class="spinner-grow" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
    </div>
`;
    $('#adv_search_results').prepend(spinner);

    const form = document.getElementById('advancedSearchForm');
    const authorsContainer = document.getElementById('coiauthors');
    const authorElements = authorsContainer.getElementsByClassName('msauthor');
    const coiauthors = Array.from(authorElements).map(authorElement => {
        const text = authorElement.textContent.trim();
        const match = text.match(/^(.+?) \((.+?)\)$/);

        if (match) {
            const [_, fullName, email] = match;
            const nameParts = fullName.split(' ');
            const lastName = nameParts.pop();
            const firstName = nameParts.join(' ');

            return {
                first_name: firstName,
                last_name: lastName,
                email: email
            };
        }

        return null;
    }).filter(author => author !== null);
    const formData = {
        full_name: form.querySelector('#full_name').value.trim(),
        first_name: form.querySelector('#first_name').value.trim(),
        last_name: form.querySelector('#last_name').value.trim(),
        email: form.querySelector('#email').value.trim(),
        orcid: form.querySelector('#orcid').value.trim(),
        keywords: form.querySelector('#keywords').value.split(',').map(kw => kw.trim()).filter(kw => kw),
        person_id: form.querySelector('#person_id').value.trim(),
        country: form.querySelector('#country').value.trim(),
        organization: form.querySelector('#organization').value.trim(),
        pub5_min: form.querySelector('#pub5_min').value.trim(),
        pub10_min: form.querySelector('#pub10_min').value.trim(),
        email_present: form.querySelector('#email_present').checked,
        person_subset_id: 23,
        person_subset_invert: 'True',
        limit: form.querySelector('#nresults').value.trim(),
        offset: form.querySelector('#oresults').value.trim(),
        add_counts_to_keywords: 'True',
        max_number_of_keywords: 20,
        coi_authors: coiauthors,
        filter_coi_coauthors: false,
        filter_coi_affiliation: false
    };

    // Filter out empty fields
    const filteredFormData = {};
    for (const key in formData) {
        if (formData[key] !== null && formData[key] !== '' && formData[key] !== undefined) {
            if (Array.isArray(formData[key])) {
                if (formData[key].length > 0) {
                    filteredFormData[key] = formData[key];
                }
            } else {
                filteredFormData[key] = formData[key];
            }
        }
    }
   
    fetch('https://rev-app.public.springernature.app/advanced_search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(filteredFormData),
        signal: signal
    })
    .then(response => response.json())
    .then(data => {
         // Print the response to the console

        const resultsContainer = document.getElementById('adv_search_results');
        resultsContainer.innerHTML = '';  // Clear previous results
        render_results(data, resultsContainer, form, signal);
        $('#loading-spinner').remove();

    })
    .catch(error => {
        if (error.name === 'AbortError') {
            console.log('Fetch aborted', error.message);
        } else {
            console.error('Error:', error);
        }
        reviewerResults.innerHTML = '';  // Clear previous results
        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-danger';
        errorMessage.textContent = `Error: ${error.message}`;
        reviewerResults.appendChild(errorMessage);
    });

}
