// Recommender.js
// Populates the ADG OVERLAY modal with ms details
// Then squeries the ADG api via proxy to avoid CORRS errors 
// Alternatively, ask ADG team to edit CORRS to allow requests from *nature.com



// Populat MS author info (names, emails) on the ADG overlay modal
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
        // Edit this to insert this above the form, not in it.
        $("#nf_assign_rev").prepend(reviewerFinderButtonHTML);

        $("#reviewerFinderBtn").click(async function () {
            await showOverlay();
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
function submitEvent() {

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
        t: document.getElementById('title').textContent.trim(),
        ab: document.getElementById('abstract').textContent.trim(),
        k: document.getElementById('rev_keywords').value.split(',').map(kw => kw.trim()).filter(kw => kw),
        country: document.getElementById('country').value.split(',').map(kw => kw.trim()).filter(kw => kw),
        pub5_min: document.getElementById('pub5_min').value.trim(),
        pub10_min: document.getElementById('pub10_min').value.trim(),
        coi_authors: coiauthors,
        person_subset_id: 23,
        person_subset_invert: 'True',
        n: document.getElementById('nresults').value.trim(),
        o: document.getElementById('oresults').value.trim(),
        add_counts_to_keywords: 'True',
        max_number_of_keywords: 20
    }

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
    console.log(filteredFormData);
    // Fetching from my proxy app
    fetch('https://calm-retreat-38808-188b35344d25.herokuapp.com/query', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(filteredFormData)
    })
        .then(response => response.json())
        .then(data => {
            const resultsContainer = document.getElementById('reviewer_results');
            resultsContainer.innerHTML = '';  // Clear previous results
            console.log(data)
            data.forEach((item, index) => {
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                resultItem.id = `result-item-${index}`;
                const shortlistedEmails = document.getElementById('shortlistedReviewers').getAttribute('data-shortlisted-emails').split(',');

                // First name, Last name, Email, ORCID number
                resultItem.innerHTML = `
                    <div class="rev-name-div d-flex flex-row align-items-center justify-content-between">
                        <span class="h2 rev-name">${item.first_name} ${item.last_name}
                            <span class='badge bg-success h3 m-2'>${item.score}</span>
                        </span>
                        <button class="btn btn-primary add-to-shortlist" ${shortlistedEmails.includes(item.email) ? 'disabled' : ''}>
                            ${shortlistedEmails.includes(item.email) ? 'Shortlisted' : '🦉Add To Shortlist'}
                        </button>
                    </div>
                    <div>
                        <a href="mailto:${item.email}">${item.email}</a>
                        ${item.orcid_ids && item.orcid_ids.length > 0
                        ? ', ' + item.orcid_ids.map(id => `<a href="https://orcid.org/${id}" target="_blank">${id}</a>`).join(', ')
                        : ''}
                    </div>
                    <div>
                        <a href="${item.ror_id}" target="_blank">${item.organization}</a>, ${item.country}
                    </div>
                    <div>
                        <a href="https://reviewerfinder.nature.com/person/${item.person_id}" target="_blank">${item.person_id}</a>
                    </div>
                    <hr>
                    <div class="card mt-2">
                        <div class="card-body">
                            <h5 class="card-title">Keywords</h5>
                            <p class="card-text">
                                ${item.keywords.slice(0, 100).map(keyword => `${keyword[0]} (${keyword[1]})`).join(', ')}
                            </p>
                        </div>
                    </div>
                    <div class="card mt-2">
                        <div class="card-body">
                            <div class="row text-center">
                                <div class="col-md-4">
                                    <div class="label">Last 5 years:</div>
                                    <div class="number h3">${item.pub_stats[5]}</div>
                                </div>
                                <div class="col-md-4">
                                    <div class="label">Last 10 years:</div>
                                    <div class="number h3">${item.pub_stats[10]}</div>
                                </div>
                                <div class="col-md-4">
                                    <div class="label">H-index:</div>
                                    <div class="number h3">${item.h_index}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                resultItem.querySelector('.add-to-shortlist').addEventListener('click', function () {
                    addToShortlist(item, this);

                });
                resultsContainer.appendChild(resultItem);

                // Fetch additional data for each person

                try {
                    fetchAdditionalData(formData.t, formData.ab, item.person_id, index);
                } catch (error) {
                    console.error('Error fetching additional data:', error);
                }

                try {
                    fetchPubData(item.person_id, index);
                } catch (error) {
                    console.error('Error fetching publication data:', error);
                }
            });
            addPaginationButtons();

            // scroll into view
            const firstResultItem = document.querySelector('.nav-bar');
            const overlayContent = document.querySelector('.overlay-content');
            if (firstResultItem && overlayContent) {
                const firstResultItemTop = firstResultItem.offsetTop;
                overlayContent.scrollTo({
                    top: firstResultItemTop,
                    behavior: 'smooth'
                });
            }
            $('#loading-spinner').remove();

        })
        .catch(error => {
            console.error('Error:', error);
        });


}
// get most relevant publications
function fetchAdditionalData(title, abstract, personId, index) {
    const endpoint = 'https://calm-retreat-38808-188b35344d25.herokuapp.com/explain';
    const params = {
        title: title,
        abstract: abstract,
        person_id: personId
    };

    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    })
        .then(response => response.json())
        .then(data => {
            if (data.length > 0 && data[0].explanations) {
                const explanations = data[0].explanations;

                // Create a new div for the publications card
                const pubsCard = document.createElement('div');
                pubsCard.className = 'card mt-2';
                const pubsCardBody = document.createElement('div'); // Create the card body
                pubsCardBody.className = 'card-body';
                const pubsCardTitle = document.createElement('h5'); // Create the card title
                pubsCardTitle.className = 'card-title';
                pubsCardTitle.textContent = 'Most Relevant Publications';

                const list = document.createElement('ol');
                explanations.forEach((explanation, idx) => {
                    const listItem = document.createElement('li');
                    const publication = document.createElement('div');
                    publication.innerHTML = `
                    ${explanation.title ? explanation.title : 'No title available'}. 
                    <strong>${explanation.journal_title ? toTitleCase(explanation.journal_title) : 'NA'}</strong>.
                    ${explanation.pub_year}. 
                    Score: ${explanation.score.toFixed(2)}. 
                    <a href="https://doi.org/${explanation.doi}" target="_blank">${explanation.doi}</a>
                `;
                    listItem.appendChild(publication);
                    list.appendChild(listItem);
                });
                pubsCardBody.appendChild(pubsCardTitle); // Append title to card body
                pubsCardBody.appendChild(list); // Append list to card body
                pubsCard.appendChild(pubsCardBody); // Append card body to card

                const resultItem = document.getElementById(`result-item-${index}`);
                resultItem.appendChild(pubsCard); // Append card to result item
            } else {
                console.error('No explanations found');
            }
        })
        .catch(error => {
            console.error('Error fetching additional data:', error);
        });
}
function renderArray(arr, type = '') {
    const container = document.createElement('div');
    arr.forEach((item, index) => {
        const element = document.createElement('div');
        element.className = 'array-item';

        if (type === 'orcid') {
            const link = document.createElement('a');
            link.href = `https://orcid.org/${item}`;
            link.textContent = item;
            link.target = "_blank";
            element.appendChild(link);
        } else if (typeof item === 'object') {
            element.appendChild(renderObject(item));
        } else {
            element.textContent = item;
        }

        container.appendChild(element);
    });
    return container;
}

function renderObject(obj) {
    const container = document.createElement('div');
    Object.keys(obj).forEach(key => {
        const element = document.createElement('div');
        element.className = 'object-item';

        const label = document.createElement('label');
        label.textContent = `${key.replace(/_/g, ' ')}: `;
        const value = document.createElement('span');

        if (typeof obj[key] === 'object' && obj[key] !== null) {
            value.appendChild(renderObject(obj[key]));
        } else {
            value.textContent = obj[key];
        }

        element.appendChild(label);
        element.appendChild(document.createTextNode(' ')); // Add space
        element.appendChild(value);
        container.appendChild(element);
    });
    return container;
}

// get author's publication history
function fetchPubData(authorId, index) {
    fetch(`https://calm-retreat-38808-188b35344d25.herokuapp.com/person/${authorId}/documents?limit=100`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(data => {
            const resultItem = document.getElementById(`result-item-${index}`);
            if (resultItem) {
                const docsCard = document.createElement('div');
                docsCard.className = 'card mt-2';
                const docsCardBody = document.createElement('div');
                docsCardBody.className = 'card-body';
                const docsCardTitle = document.createElement('h5');
                docsCardTitle.textContent = 'Journals';
                docsCardBody.appendChild(docsCardTitle);
                docsCard.appendChild(docsCardBody);
                resultItem.appendChild(docsCard);

                const documents = data.results;
                const jlist = processDocuments(documents);



                const journalCountsList = document.createElement('div');
                const chunkSize = 3;

                for (let i = 0; i < jlist.length; i += chunkSize) {
                    const row = document.createElement('ul');
                    row.className = 'list-group list-group-horizontal-sm';

                    const chunk = jlist.slice(i, i + chunkSize);
                    chunk.forEach(journal => {
                        const listItem = document.createElement('li');
                        listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                        listItem.textContent = journal.title;
                        const badge = document.createElement('span');
                        badge.className = 'badge bg-primary rounded-pill';
                        badge.textContent = journal.count;
                        listItem.appendChild(badge);
                        row.appendChild(listItem);
                    });

                    journalCountsList.appendChild(row);
                }

                docsCardBody.appendChild(journalCountsList);


            }
        })
        .catch(error => {
            console.error('Error fetching documents:', error);
        });
}
function processDocuments(documents) {
    const result = {};

    documents.forEach((doc) => {
        const journal = doc.issue?.journal || {};
        const issn = journal.issn;
        const titles = Array.isArray(journal.title) ? journal.title : []; // Ensure titles is an array

        if (issn) {
            if (!result[issn]) {
                result[issn] = {
                    titles: new Set(),
                    count: 0,
                };
            }

            titles.forEach((title) => {
                result[issn].titles.add(title);
            });

            result[issn].count += 1;
        }
    });

    // Process titles and convert Set to single title
    for (const issn in result) {
        let titlesArray = Array.from(result[issn].titles);
        let title = titlesArray.length > 0 ? titlesArray[0] : "NA";
        title = title
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        result[issn].title = title;
        delete result[issn].titles;
    }

    // Convert result to array and sort by count
    const sortedResult = Object.entries(result)
        .map(([issn, data]) => ({ issn, ...data }))
        .sort((a, b) => b.count - a.count);

    return sortedResult;
}

function addPaginationButtons() {

    const navBarHtml = `
    <div class="nav-bar">
      <button class="nav-button prev-button">Previous</button>
      <span class="result-info">Showing results 1-20</span>
      <button class="nav-button next-button">Next</button>
    </div>
  `;

    // Insert this nav bar at the top of the results container
    const resultsContainer = document.getElementById('reviewer_results');
    resultsContainer.insertAdjacentHTML('afterbegin', navBarHtml);

    // Insert this nav bar at the bottom of the results container
    resultsContainer.insertAdjacentHTML('beforeend', navBarHtml);

    // Get references to the new buttons and result info spans
    const topPrevButton = resultsContainer.querySelector('.nav-bar .prev-button');
    const topNextButton = resultsContainer.querySelector('.nav-bar .next-button');
    const topResultInfo = resultsContainer.querySelector('.nav-bar .result-info');

    const bottomPrevButton = resultsContainer.lastElementChild.querySelector('.nav-bar .prev-button');
    const bottomNextButton = resultsContainer.lastElementChild.querySelector('.nav-bar .next-button');
    const bottomResultInfo = resultsContainer.lastElementChild.querySelector('.nav-bar .result-info');

    function updateResultInfo(start, end) {
        const resultInfo = `Showing results ${start}-${end}`;
        topResultInfo.textContent = resultInfo;
        bottomResultInfo.textContent = resultInfo;
    }

    function handlePrevButtonClick(event) {
        event.preventDefault();
        const offsetInput = document.getElementById('oresults');
        const nresults = parseInt(document.getElementById('nresults').value, 10);
        let currentOffset = parseInt(offsetInput.value, 10);
        currentOffset = Math.max(currentOffset - nresults, 0);
        offsetInput.value = currentOffset;
        updateResultInfo(currentOffset + 1, currentOffset + nresults);
        submitEvent();
    }

    function handleNextButtonClick(event) {
        event.preventDefault();
        const offsetInput = document.getElementById('oresults');
        const nresults = parseInt(document.getElementById('nresults').value, 10);
        let currentOffset = parseInt(offsetInput.value, 10);
        currentOffset += nresults;
        offsetInput.value = currentOffset;
        updateResultInfo(currentOffset + 1, currentOffset + nresults);
        submitEvent();
    }

    topPrevButton.addEventListener('click', handlePrevButtonClick);
    topNextButton.addEventListener('click', handleNextButtonClick);
    bottomPrevButton.addEventListener('click', handlePrevButtonClick);
    bottomNextButton.addEventListener('click', handleNextButtonClick);

    // Hide the Previous button if the offset is zero
    const offsetInput = document.getElementById('oresults');
    if (parseInt(offsetInput.value, 10) === 0) {
        topPrevButton.style.display = 'none';
        bottomPrevButton.style.display = 'none';
    } else {
        topPrevButton.style.display = 'inline-block';
        bottomPrevButton.style.display = 'inline-block';
    }

    // Initial update of the result info
    const nresults = parseInt(document.getElementById('nresults').value, 10);
    const currentOffset = parseInt(offsetInput.value, 10);
    updateResultInfo(currentOffset + 1, currentOffset + nresults);
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
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `);
    $(matchesDiv).prepend($spinner);

    try {
        const form = document.getElementById("nf_assign_rev");
        const { formType, jId, msId, msRevNo, msIdKey, ndt, currentStageId, desiredRevCnt } = getPageParams(form);

        const searchData = await eJPPersonSearch(firstName, lastName, "", "", jId, msId, msRevNo, msIdKey, currentStageId, desiredRevCnt) || [];
        const searchDataByEmail = await eJPPersonSearch("", "", email, "", jId, msId, msRevNo, msIdKey, currentStageId, desiredRevCnt) || [];

        if ((!searchData || searchData.length === 0) && (!searchDataByEmail || searchDataByEmail.length === 0)) {
            matchesDiv.innerHTML = `<div class="eJPResult"><span>❌ Not on eJP</span></div>`;
        } else {
            if (!searchDataByEmail || searchDataByEmail.length === 0) {
                matchesDiv.innerHTML += `<div class="eJPResult"><span>❌ Email not on eJP</span></div>`;
            }

            const combinedData = [...searchData, ...searchDataByEmail].filter(element => element !== null);
            const uniqueCombinedData = Array.from(new Map(combinedData.map(item => [item['authId'], item])).values());

            for (const dataItem of uniqueCombinedData) {
                await appendMatchItem(matchesDiv, dataItem);
            }

        }
        console.log("all reviewers");


    } catch (error) {
        console.error("Error during eJPPersonSearch:", error);
        matchesDiv.innerHTML = "Failed to load data";
        $(`#${spinnerId}`).remove();
    } finally {
        // Reorder and highlight matches after all operations are complete
        reorderAndHighlightMatches(matchesDiv, email);
        $(`#${spinnerId}`).remove();
        console.log("removed");
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
        ${dataItem.conflicts ? ` ${dataItem.conflicts}` : ''}
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

            const selectedReviewers = document.querySelectorAll('#shortlistedReviewers input[type="checkbox"]:checked');

            const operationPromises = [];

            selectedReviewers.forEach(checkbox => {
                const firstName = checkbox.dataset.fname;
                const lastName = checkbox.dataset.lname;
                const email = checkbox.dataset.email;
                const inst = checkbox.dataset.inst;
                const status = checkbox.dataset.status;
                console.log(email, status);
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
                    assignSelectedBtn.disabled = false;
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

