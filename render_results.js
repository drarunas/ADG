// show reviewer results (data) inside container
// data source is either rev_rec or adv_search

async function render_results(data, container, form, signal) {
    // Abort any ongoing fetches if a new submission is made

    const allPromises = [];
    data.forEach((item, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.id = `result-item-${index}`;
        const shortlistedEmails = document.getElementById('shortlistedReviewers').getAttribute('data-shortlisted-emails').split(',');

        // First name, Last name, Email, ORCID number
        resultItem.innerHTML = `
            <div class="rev-name-div d-flex flex-row align-items-center justify-content-between">
                <span class="h2 rev-name">${item.first_name} ${item.last_name}
                    <span class='badge bg-success h3 m-2'>${item.score.toFixed(2)}</span>

                </span>
                <button class="btn btn-primary add-to-shortlist" ${shortlistedEmails.includes(item.email) ? 'disabled' : ''}>
                    ${shortlistedEmails.includes(item.email) ? 'Shortlisted' : '🦉Add To Shortlist'}
                </button>
            </div>
            <div>
                <a href="mailto:${item.email}">${item.email}</a>
                ${item.orcid_ids && item.orcid_ids.length > 0
                ? ' ' + item.orcid_ids.map(id => `<a href="https://orcid.org/${id}" target="_blank">${id}</a>`).join(', ')
                : ''}
            </div>
            <div>
                <a href="${item.ror_id}" target="_blank">${item.organization}</a>, ${item.country}
            </div>
            <div>
                <a href="https://reviewerfinder.nature.com/person/${item.person_id}" target="_blank">${item.person_id}</a>
            </div>
            
    <div class="card mt-2 coi-card d-flex flex-wrap invisible">
        <div class="card-body">
            <div class="coi-info"></div>
        </div>       
    </div>

            <div class="card mt-2">
                <div class="card-body">
                    <p class="card-text">
                        ${item.keywords ? item.keywords.slice(0, 100).map(keyword => `${keyword[0]} (${keyword[1]})`).join(', ') : 'No keywords'}
                    </p>

                </div>
            </div>
            <div class="card mt-2">
                <div class="card-body">
                    <div class="row text-center">
                        <div class="col-md-4">
                            <div class="label">Last 5 years:</div>
                            <div class="number h3">${item.pub_stats && item.pub_stats[5] !== null ? item.pub_stats[5] : 'N/A'}</div>
                        </div>
                        <div class="col-md-4">
                            <div class="label">Last 10 years:</div>
                            <div class="number h3">${item.pub_stats && item.pub_stats[10] !== null ? item.pub_stats[10] : 'N/A'}</div>
                        </div>
                        <div class="col-md-4">
                            <div class="label">H-index:</div>
                            <div class="number h3">${item.h_index !== null ? item.h_index : 'N/A'}</div>
                        </div>
                    </div>

                </div>
            </div>

        `;
        
        if (item.coi_coauthors || (item.coi_affiliation && item.coi_affiliation.length > 0)) {
            const coiCard = resultItem.querySelector('.coi-card');
            coiCard.classList.remove('invisible'); // Unhide the card if there is COI information
        
            const coiInfo = coiCard.querySelector('.coi-info');
            let coiContent = '';
        
            if (item.coi_coauthors) {
                coiContent += `
                    <span class="badge bg-danger m-1 p-2">COI: ${item.coi_coauthors}</span>
                `;
            }
        
            if (item.coi_affiliation && item.coi_affiliation.length > 0) {
                coiContent += `
                    <div class="d-flex flex-wrap">
                        ${item.coi_affiliation.map(aff => `
                            <span class="badge bg-danger m-1 p-2">
                                Affiliation COI: ${aff.author_name}, ${aff.organization} (${aff.last_overlapping_date})
                            </span>
                        `).join('')}
                    </div>
                `;
            }
        
            coiInfo.innerHTML = coiContent;
        }

        resultItem.querySelector('.add-to-shortlist').addEventListener('click', function () {
            addToShortlist(item, this);

        });
        container.appendChild(resultItem);
        const t = document.getElementById('title').textContent.trim();
        const ab = document.getElementById('abstract').textContent.trim();
        // Create promises for fetchAdditionalData and fetchPubData
        const additionalDataPromise = fetchAdditionalData(t, ab, item.person_id, index, container, signal);
        const pubDataPromise = fetchPubData(item.person_id, index, container, signal);

        // Add promises to the array
        allPromises.push(additionalDataPromise, pubDataPromise);

        // Fetch additional data for each person

    });
    addPaginationButtons(container, form);
    await Promise.all(allPromises);


}





// get most relevant publications
async function fetchAdditionalData(title, abstract, personId, index, container, signal) {
    const endpoint = 'https://rev-app.public.springernature.app/explain';
    const params = {
        title: title,
        abstract: abstract,
        person_id: personId
    };

    return fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params),
        signal: signal
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
                
                const resultItem = container.querySelector(`#result-item-${index}`);
                resultItem.appendChild(pubsCard); // Append card to result item
            } else {
                console.error('No explanations found');
            }
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Error fetching additional data:', error);
            }
        });
}





// get author's publication history
async function fetchPubData(authorId, index, container, signal) {
    return fetch(`https://rev-app.public.springernature.app/person/${authorId}/documents?limit=100`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        signal: signal
    })
        .then(response => response.json())
        .then(data => {
            const resultItem = container.querySelector(`#result-item-${index}`);
            if (resultItem) {
                const docsCard = document.createElement('div');
                docsCard.className = 'card mt-2';
                const docsCardBody = document.createElement('div');
                docsCardBody.className = 'card-body';
                const docsCardTitle = document.createElement('h5');

                docsCard.appendChild(docsCardBody);
                resultItem.appendChild(docsCard);

                const documents = data.results;
                const jlist = processDocuments(documents);

                const journalCountsList = document.createElement('div');
                journalCountsList.className = 'd-flex flex-wrap journals-list justify-content-center align-items-center p-1'
                jlist.forEach(journal => {

                    const listItem = document.createElement('div');
                    listItem.className = 'd-flex justify-content-between align-items-center journal-div';
                    listItem.textContent = journal.title;
                    const badge = document.createElement('span');
                    badge.className = 'badge bg-primary rounded-pill';
                    badge.textContent = journal.count;
                    listItem.appendChild(badge);
                    journalCountsList.appendChild(listItem);

                });
              


                docsCardBody.appendChild(journalCountsList);


            }
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
            } else {
                console.error('Error fetching documents:', error);
            }
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

function addPaginationButtons(container, form) {

    const navBarHtml = `
    <div class="nav-bar">
      <button class="nav-button prev-button">Previous</button>
      <span class="result-info">Showing results 1-20</span>
      <button class="nav-button next-button">Next</button>
    </div>
  `;

    // Insert this nav bar at the top of the results container
    const resultsContainer = container;
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
        const offsetInput = form.querySelector('#oresults');
        const nresults = parseInt(form.querySelector('#nresults').value, 10);
        let currentOffset = parseInt(offsetInput.value, 10);
        currentOffset = Math.max(currentOffset - nresults, 0);
        offsetInput.value = currentOffset;
        updateResultInfo(currentOffset + 1, currentOffset + nresults);
        if (form) {
            // Create a new event
            const event = new Event('submit', {
                'bubbles': true,
                'cancelable': true
            });
        
            // Dispatch the event
            form.dispatchEvent(event);
        } else {
            console.error('Form not found');
        }
    }

    function handleNextButtonClick(event) {
        event.preventDefault();
        const offsetInput = form.querySelector('#oresults');
        const nresults = parseInt(form.querySelector('#nresults').value, 10);
        let currentOffset = parseInt(offsetInput.value, 10);
        currentOffset += nresults;
        offsetInput.value = currentOffset;
        updateResultInfo(currentOffset + 1, currentOffset + nresults);
        if (form) {
            // Create a new event
            const event = new Event('submit', {
                'bubbles': true,
                'cancelable': true
            });
        
            // Dispatch the event
            form.dispatchEvent(event);
        } else {
            console.error('Form not found');
        }

    }

    topPrevButton.addEventListener('click', handlePrevButtonClick);
    topNextButton.addEventListener('click', handleNextButtonClick);
    bottomPrevButton.addEventListener('click', handlePrevButtonClick);
    bottomNextButton.addEventListener('click', handleNextButtonClick);

    // Hide the Previous button if the offset is zero
    const offsetInput = form.querySelector('#oresults');
    if (parseInt(offsetInput.value, 10) === 0) {
        topPrevButton.style.display = 'none';
        bottomPrevButton.style.display = 'none';
    } else {
        topPrevButton.style.display = 'inline-block';
        bottomPrevButton.style.display = 'inline-block';
    }

    // Initial update of the result info
    const nresults = parseInt(form.querySelector('#nresults').value, 10);
    const currentOffset = parseInt(offsetInput.value, 10);
    updateResultInfo(currentOffset + 1, currentOffset + nresults);
}