// Recommender.js
// Populates the ADG OVERLAY modal with ms details
// Then squeries the ADG api via proxy to avoid CORRS errors 
// Alternatively, ask ADG team to edit CORRS to allow requests from *nature.com



// Populate MS author info (names, emails) on the ADG overlay modal
async function populateAuthors() {
    // getDetails is in MSDetails.js
    const details = getDetails();
    const authorsDiv = $('#coiauthors');
    authorsDiv.empty(); // Clear any existing content

    for (const author of details.authors) {
        const email = await eJPGetEmail(author.link);
        const authorElement = `<span class="msauthor">${author.name} (${email}) </span>`;
        authorsDiv.append(authorElement);
    }
}

$(document).ready(function () {
    if ($("#nf_assign_rev").length > 0) {
        const reviewerFinderButtonHTML = '<button id="reviewerFinderBtn" class="mb-2 btn btn-primary" title="Recommender">Reviewer Recommender</button>';
 
        $("#nf_assign_rev").before(reviewerFinderButtonHTML);

        const ECR_url = '<div><button class="mb-2 btn link-btn btn-sm btn-primary" onclick="window.open(\'https://docs.google.com/spreadsheets/d/1WhTsRvd_nXDEK2AT0QPJu7Zf7KQFVkYo/edit?gid=1021598913#gid=1021598913\', \'_blank\')">ECR Reviewer Database</button></div>';
        $("#nf_assign_rev").before(ECR_url);
        
        


        $("#reviewerFinderBtn").click(async function () {
            await showOverlay();
            init_advanced_search();
            //set up edit abstract 
            document.getElementById('editAbstractBtn').addEventListener('click', function(event) {
                console.log(event);
                event.preventDefault();
                var abstractElement = document.getElementById('abstract');
                if (abstractElement.contentEditable === "true") {
                    abstractElement.contentEditable = "false";
                    this.textContent = "Edit";
                    // You might want to save the changes here
                } else {
                    abstractElement.contentEditable = "true";
                    this.textContent = "Save";
                    abstractElement.focus();
                }
            });
        });
    }

    async function showOverlay() {
        const overlayId = 'adgoverlay';

        if (!$(`#${overlayId}`).length) {
            const overlayHTML = await fetch(chrome.runtime.getURL('adgoverlay.html')).then(response => response.text());
            $('body').append(overlayHTML);


            $('#closeOverlay').click(function () {
                $(`#${overlayId}`).hide();
            });

            $(`#${overlayId}`).click(function (e) {
                if (e.target.id === overlayId) {
                    $(`#${overlayId}`).hide();
                }
            });
            document.getElementById('queryForm').addEventListener('submit', function (event) {
                event.preventDefault();
                submitEvent();
            });
            const details = getDetails();
            console.log(details);
            $('#title').text(details.title);
            $('#abstract').text(details.abstract);
            await populateAuthors();

            setupAssignSelectedButton();
        } else {
            $(`#${overlayId}`).show();
        }
    }



});

// When the user clicks Submit button on ADG OVERLAY modal
let currentAbortController = null;

function submitEvent() {
    // Abort any ongoing fetches if a new submission is made
    if (currentAbortController) {
        currentAbortController.abort();
    }

    // Create a new AbortController instance for the current submission
    currentAbortController = new AbortController();
    const { signal } = currentAbortController;

    const form = document.getElementById('queryForm');
    $('#reviewer_results').empty();
    const spinner = `
    <div class="d-flex justify-content-center text-primary" id="loading-spinner">
        <div class="spinner-grow" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
    </div>
`;
    $('#reviewer_results').prepend(spinner);

    // Author information already on the overlay
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
        t: form.querySelector('#title').textContent.trim(),
        ab: form.querySelector('#abstract').textContent.trim(),
        k: form.querySelector('#rev_keywords').value.split(',').map(kw => kw.trim()).filter(kw => kw),
        country: form.querySelector('#country').value.split(',').map(kw => kw.trim()).filter(kw => kw),
        pub5_min: form.querySelector('#pub5_min').value.trim(),
        pub10_min: form.querySelector('#pub10_min').value.trim(),
        coi_authors: coiauthors,
        person_subset_id: 23,
        person_subset_invert: 'True',
        n: form.querySelector('#nresults').value.trim(),
        o: form.querySelector('#oresults').value.trim(),
        add_counts_to_keywords: 'True',
        max_number_of_keywords: 20,
        filter_coi_coauthors: form.querySelector('#flexSwitchCheckCOI').checked,
        filter_coi_affiliation: form.querySelector('#flexSwitchCheckCOI').checked,
        highlight_keywords: true
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

    // Fetching from my proxy app
    fetch('https://rev-app.public.springernature.app/query', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(filteredFormData),
        signal: signal
    })
        .then(response => response.json())
        .then(data => {
            const resultsContainer = document.getElementById('reviewer_results');
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


async function addToShortlist(reviewer, button) {
    const shortlistContainer = document.getElementById('shortlistedReviewers');
    const emailLowerCase = reviewer.email.toLowerCase();
    const middleInitialPart = reviewer.middle_initials ? ` ${reviewer.middle_initials}` : "";
    // Create the flying element
    // Create the flying element
    const flyingElement = document.createElement('div');
    flyingElement.className = 'fly-animation';
    flyingElement.textContent = '🦉';
    document.body.appendChild(flyingElement);

    // Get button and shortlist tab link positions
    const buttonRect = button.getBoundingClientRect();
    const shortlistTabLink = document.getElementById('shortlistTabLink');
    const shortlistTabRect = shortlistTabLink.getBoundingClientRect();

    // Set initial position of the flying element
    flyingElement.style.left = `${buttonRect.left + window.scrollX}px`;
    flyingElement.style.top = `${buttonRect.top + window.scrollY}px`;


    const translateX = (shortlistTabRect.left + shortlistTabRect.width / 2) - (buttonRect.left);
    const translateY = (shortlistTabRect.top + shortlistTabRect.height / 2) - (buttonRect.top);
    // Set custom properties for the animation
    flyingElement.style.setProperty('--translate-x', `${translateX}px`);
    flyingElement.style.setProperty('--translate-y', `${translateY}px`);

    // Trigger reflow to restart the animation
    flyingElement.offsetWidth;

    // Wait for animation to end
    setTimeout(() => {
        flyingElement.remove();
    }, 600);


    const reviewerDetails = `
    <div class="shortlist-rev-card mb-2">
        
            <div class="main-shortlisted-rev">
                <input type="checkbox" class="form-check-input pcheck" value="${emailLowerCase}" data-status="new" data-fname="${reviewer.first_name}" data-lname="${reviewer.last_name}" data-email="${emailLowerCase}" data-inst="${reviewer.organization}">
        <span>🦉${reviewer.first_name}${middleInitialPart} ${reviewer.last_name}, 📧${emailLowerCase}, ${reviewer.organization}</span>
                </div>
            <div class="ejp-matches-div" id="matches-${emailLowerCase.replace(/[@.]/g, '')}">
            </div>

    </div>
    `;
    shortlistContainer.insertAdjacentHTML('beforeend', reviewerDetails);

    // Disable the button and change its text
    button.disabled = true;
    button.textContent = 'Shortlisted';

    // Update the data-shortlisted-emails attribute
    const shortlistedEmails = shortlistContainer.getAttribute('data-shortlisted-emails').split(',').filter(email => email);
    shortlistedEmails.push(reviewer.email);
    shortlistContainer.setAttribute('data-shortlisted-emails', shortlistedEmails.join(','));

    // Check for matches on the system and update the matches div
    await checkForMatches(reviewer.first_name, reviewer.last_name, reviewer.email, reviewer.organization, `matches-${emailLowerCase.replace(/[@.]/g, '')}`);
}

async function checkForMatches(firstName, lastName, email, inst, matchesDivId) {
    const matchesDiv = document.getElementById(matchesDivId);
    const spinnerId = `matches-spinner-${matchesDivId}`;
    const $spinner = $(`
        <div class="d-flex justify-content-left text-primary" id="${spinnerId}">
            <div class="spinner-grow  matches-spinner" role="status">
                <span class="visually-hidden">Searching eJP...</span>
            </div>
            <span>Searching eJP</span>
        </div>
        
    `);
    $(matchesDiv).prepend($spinner);

    try {
        const form = document.getElementById("nf_assign_rev");
        const { formType, jId, msId, msRevNo, msIdKey, ndt, currentStageId, desiredRevCnt } = getPageParams(form);

       //const searchData = await eJPPersonSearch(firstName, lastName, "", "", jId, msId, msRevNo, msIdKey, currentStageId, desiredRevCnt) || [];
       const searchData = [];
        const searchDataByEmail = await eJPPersonSearch("", "", email, "", jId, msId, msRevNo, msIdKey, currentStageId, desiredRevCnt) || [];

        if ((!searchData || searchData.length === 0) && (!searchDataByEmail || searchDataByEmail.length === 0)) {
            matchesDiv.innerHTML = `<div class="eJPResult"><span>❌ Not on eJP</span></div>`;
            const parentElement = matchesDiv.parentElement;
    
            if (parentElement) {
                // Find the div with the class "main-shortlisted-rev" within the parent element
                const mainShortlistedRev = parentElement.querySelector('.main-shortlisted-rev');
                
                if (mainShortlistedRev) {
                    // Find the checkbox inside this div and check it
                    const checkBox = mainShortlistedRev.querySelector('input[type="checkbox"]');
                    if (checkBox) {
                        checkBox.checked = true;
                    } else {
                        console.error('Checkbox not found inside the .main-shortlisted-rev div');
                    }
                } else {
                    console.error('.main-shortlisted-rev not found within the parent element');
                }
            } else {
                console.error('Parent element of matchesDiv not found');
            }
        } else {
            if (!searchDataByEmail || searchDataByEmail.length === 0) {
                matchesDiv.innerHTML += `<div class="eJPResult"><span>❌ Email not on eJP</span></div>`;
                // find closest div of clas "main-shortlisted-rev", and check the tickbox inside of it
                const parentElement = matchesDiv.parentElement;
    
                if (parentElement) {
                    // Find the div with the class "main-shortlisted-rev" within the parent element
                    const mainShortlistedRev = parentElement.querySelector('.main-shortlisted-rev');
                    
                    if (mainShortlistedRev) {
                        // Find the checkbox inside this div and check it
                        const checkBox = mainShortlistedRev.querySelector('input[type="checkbox"]');
                        if (checkBox) {
                            checkBox.checked = true;
                        } else {
                            console.error('Checkbox not found inside the .main-shortlisted-rev div');
                        }
                    } else {
                        console.error('.main-shortlisted-rev not found within the parent element');
                    }
                } else {
                    console.error('Parent element of matchesDiv not found');
                }

            }

            const combinedData = [...searchData, ...searchDataByEmail].filter(element => element !== null);
            const uniqueCombinedData = Array.from(new Map(combinedData.map(item => [item['authId'], item])).values());

            for (const dataItem of uniqueCombinedData) {
                await appendMatchItem(matchesDiv, dataItem);
            }

        }



    } catch (error) {
        console.error("Error during eJPPersonSearch:", error);
        matchesDiv.innerHTML = "Failed to load data";
        $(`#${spinnerId}`).remove();
    } finally {
        // Reorder and highlight matches after all operations are complete
        reorderAndHighlightMatches(matchesDiv, email);
        $(`#${spinnerId}`).remove();
        
    }
}

async function appendMatchItem(matchesDiv, dataItem) {
        // Fetch and display email if available
        var fetchedEmail = '';
        try {
            fetchedEmail = await eJPGetEmail(dataItem.nameHref);

        } catch (error) {
            console.error("Error fetching email:", dataItem.name, error);
        }

    const matchItem = document.createElement('div');
    matchItem.className = 'eJPResult';
    matchItem.innerHTML = `<input type="checkbox" class="form-check-input pcheck" value="${dataItem.authId}" data-status="existing">
        <span >
        <a href="${dataItem.nameHref}" target="_blank">${dataItem.name}</a>, ${dataItem.organization}
        ${dataItem.pending ? ` ❗Pending: ${dataItem.pending}` : ''}
        ${dataItem.averageDuration ? ` 🕓${dataItem.averageDuration}` : ''}
        <span class="bg-warning rounded">${dataItem.conflicts ? `${dataItem.conflicts}` : ''}</span>
        ${fetchedEmail ? ` 📧${fetchedEmail}` : ''}
        </span>
    `;

    matchesDiv.appendChild(matchItem);


}

// Function to reorder and highlight matches
function reorderAndHighlightMatches(matchesDiv, email) {
    const emailText = `📧${email.toLowerCase()}`;
    const alreadyAssignedText = "Already Assigned";
    const matches = Array.from(matchesDiv.children);

    matches.forEach(matchItem => {
        const textContent = matchItem.textContent || matchItem.innerText;

        if (textContent.includes(emailText)) {
            matchItem.classList.add("matchingLi");
            matchItem.querySelector('input[type="checkbox"]').checked = true;
            matchesDiv.insertBefore(matchItem, matchesDiv.firstChild);
        }

        if (textContent.includes(alreadyAssignedText)) {
            const checkbox = matchItem.querySelector('input[type="checkbox"]');
            checkbox.checked = false;
            checkbox.disabled = true;
        }
    });
}


function setupAssignSelectedButton() {
    const assignSelectedBtn = document.getElementById('assignSelectedBtn');
    if (assignSelectedBtn) {
        assignSelectedBtn.addEventListener('click', async () => {
            assignSelectedBtn.disabled = true;
            const overlayContent = document.querySelector('.overlay-content');
            overlayContent.classList.add('disabled');
    
            const loader = document.createElement('div');
            loader.classList.add('overlay-loader');
            overlayContent.appendChild(loader);

            const selectedReviewers = document.querySelectorAll('#shortlistedReviewers input[type="checkbox"]:checked');

            const operationPromises = [];

            selectedReviewers.forEach(checkbox => {
                const firstName = checkbox.dataset.fname;
                const lastName = checkbox.dataset.lname;
                const email = checkbox.dataset.email;
                const inst = checkbox.dataset.inst;
                const status = checkbox.dataset.status;
                
                const form = document.getElementById("nf_assign_rev");
                const { formType, jId, msId, msRevNo, msIdKey, ndt, currentStageId, desiredRevCnt } = getPageParams(form);
                if (status === "new") {
                    operationPromises.push(submitFormAssign(firstName, lastName, email, inst));
                } else if (status === "existing") {
                    const reviewerId = checkbox.value;
                    operationPromises.push(assignReviewer(reviewerId,
                        jId,
                        msId,
                        msRevNo,
                        msIdKey,
                        currentStageId));
                }
            });

            await Promise.all(operationPromises)
                .then(() => {
                    console.log("All reviewers have been successfully assigned.");

                    const hosthref = $('#nf_assign_rev').attr('action');
                    const form = document.getElementById("nf_assign_rev");
                    const { formType, jId, msId, msRevNo, msIdKey, ndt, currentStageId, desiredRevCnt } = getPageParams(form);
                    window.location.href = `${hosthref}?form_type=${formType}&j_id=${jId}&ms_id=${msId}&ms_rev_no=${msRevNo}&ms_id_key=${msIdKey}&current_stage_id=${currentStageId}&show_tab=CurrentList&redirected=1&desired_rev_cnt=${desiredRevCnt}`;

                })
                .catch((error) => {
                    console.error("An error occurred during the assignments:", error);
                })
                .finally(() => {
                    
                });
        });
    }
};

async function submitFormAssign(firstName, lastName, email, inst) {
    const form = document.getElementById("nf_assign_rev");

    const { formType, jId, msId, msRevNo, msIdKey, ndt, currentStageId, desiredRevCnt } = getPageParams(form);

    // Constructing the request body
    const requestBody = `form_type=${encodeURIComponent(formType)}&j_id=${encodeURIComponent(jId)}&ms_id=${encodeURIComponent(msId)}&ms_rev_no=${encodeURIComponent(msRevNo)}&ms_id_key=${encodeURIComponent(msIdKey)}&ndt=${encodeURIComponent(ndt)}&current_stage_id=${encodeURIComponent(currentStageId)}&first_nm=${encodeURIComponent(firstName)}&last_nm=${encodeURIComponent(lastName)}&org=${encodeURIComponent(inst)}&desired_rev_cnt=${encodeURIComponent(desiredRevCnt)}&email=${encodeURIComponent(email)}&action=Add+Person+Check`;

    try {
        console.log("assigning new");
        const response = await fetchNatureData(requestBody);

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Check for the existence of a span with class "MSG"
        const msgSpan = doc.querySelector("span.MSG");
        const tableExists = doc.querySelector("#artv_search_results_tbl") !== null;

        if (msgSpan && msgSpan.textContent.includes("Possible matching accounts found") && tableExists) {
            const inputRadio = doc.querySelector('input[type="radio"][name="reviewer"]');
            if (inputRadio) {
                const reviewerId = inputRadio.value;
                console.log("Reviewer ID:", reviewerId);

                // Call assignReviewer with all necessary parameters
                await assignReviewer(reviewerId, jId, msId, msRevNo, msIdKey, currentStageId);
            } else {
                console.log("No matching input element found.");
            }
        } else {
            // Handle cases without matching accounts or redirection
            // [Your existing logic for handling these cases]
        }
    } catch (error) {
        console.error("Error in fetch operation:", error);
    }
}

async function assignReviewer(reviewerId, jId, msId, msRevNo, msIdKey, currentStageId) {
    const requestBody = `form_type=assign_rev_tab_view_store&j_id=${encodeURIComponent(jId)}&ms_id=${encodeURIComponent(msId)}&ms_rev_no=${encodeURIComponent(msRevNo)}&ms_id_key=${encodeURIComponent(msIdKey)}&current_stage_id=${encodeURIComponent(currentStageId)}&reviewer=${encodeURIComponent(reviewerId)}&action=Assign`;

    try {
        const response = await fetchNatureData(requestBody);
        if (!response.ok) {
            throw new Error("Network response was not ok.");
        }
        const data = await response.text(); // Or response.json() if the response is JSON.
        console.log("Assignment successful");
    } catch (error) {
        console.error("Error during assignment:", error);
    }
}

