// Recommender.js
// Function to fetch email
async function eJPGetEmail(nameHref) {
    try {
        const response = await fetch(nameHref);
        if (!response.ok) throw new Error("Failed to fetch page");

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const mailtoLink = doc.querySelector('a[href^="mailto:"]');

        if (mailtoLink) {
            const email = mailtoLink
                .getAttribute("href")
                .replace("mailto:", "");
            console.log(email);
            return email;
        }
        return null; // Return null if no email found
    } catch (error) {
        console.error("Error opening page or parsing email:", error);
        return null; // Return null in case of error
    }
}

async function populateAuthors() {
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
        const reviewerFinderButtonHTML = '<button id="reviewerFinderBtn" class="mb-2" title="Recommender">Reviewer Recommender</button>';
        $("#nf_assign_rev").prepend(reviewerFinderButtonHTML);

        $("#reviewerFinderBtn").click(async function () {
            await showOverlay();
        });
    }

    async function showOverlay() {
        const overlayId = 'adgoverlay';

        if (!$(`#${overlayId}`).length) {
            const overlayHTML = await fetch(chrome.runtime.getURL('adgoverlay.html')).then(response => response.text());
            const overlayContainer = `
                <div class="adgoverlay" id="${overlayId}">
                    <div class="overlay-content">
                        <button id="closeOverlay" class="close-btn">&times;</button>
                        ${overlayHTML}
                    </div>
                </div>
            `;
            $('body').append(overlayContainer);


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
                // set offset to 0
                submitEvent();
            });
            const details = getDetails();
            console.log(details);
            $('#title').text(details.title);
            $('#abstract').text(details.abstract);
            await populateAuthors();
        } else {
            $(`#${overlayId}`).show();
        }
    }
});



function submitEvent() {

    $('#reviewer_results').empty();

    const spinner = `
    <div class="d-flex justify-content-center my-3 text-primary" id="loading-spinner">
        <div class="spinner-grow" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
    </div>
`;
    $('#reviewer_results').prepend(spinner);

    // Extracting author information
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

                // First name, Last name, Email, ORCID number
                const name = document.createElement('div');
                name.innerHTML = `
                        <span class="h2">${item.first_name} ${item.last_name}<span class='badge bg-success h3 m-2'>${item.score}</span> </span>
                    `;
                resultItem.appendChild(name);
                //email and orcid 
                // Create a new div or span for email and ORCID IDs
                const EmailOrcid = document.createElement('div');
                // Check if orcid_ids is not null and has any IDs
                let orcidLinks = item.orcid_ids && item.orcid_ids.length > 0
                    ? item.orcid_ids.map(id => `<a href="https://orcid.org/${id}" target="_blank">${id}</a>`).join(', ')
                    : '';

                // Set the innerHTML with a conditional check for orcidLinks
                EmailOrcid.innerHTML = `
        <a href="mailto:${item.email}">${item.email}</a>
        ${orcidLinks ? ', ' + orcidLinks : ''}
    `;

                // Append EmailOrcid to the desired parent element
                resultItem.appendChild(EmailOrcid);

                // Institution, Country
                const institutionCountry = document.createElement('div');
                institutionCountry.innerHTML = `
                        <a href="${item.ror_id}" target="_blank">${item.organization}</a>, ${item.country}
                    `;
                resultItem.appendChild(institutionCountry);

                const personIdDiv = document.createElement('div'); // New div for Person ID
                const personIdLink = document.createElement('a');
                personIdLink.href = `https://reviewerfinder.nature.com/person/${item.person_id}`;
                personIdLink.target = "_blank";
                personIdLink.textContent = item.person_id;
                personIdDiv.appendChild(personIdLink); // Append link to the new div
                resultItem.appendChild(personIdDiv); // Append the new div to the result item

                // Separator
                const separator = document.createElement('hr');
                resultItem.appendChild(separator);

                // Keywords
                const keywordsCard = document.createElement('div'); // Create a new div for the keywords card
                keywordsCard.className = 'card mt-2'; // Use Bootstrap card and margin-top classes
                const keywordsCardBody = document.createElement('div'); // Create the card body
                keywordsCardBody.className = 'card-body';
                const keywordsCardTitle = document.createElement('h5'); // Create the card title
                keywordsCardTitle.className = 'card-title';
                keywordsCardTitle.textContent = 'Keywords';
                const formattedKeywords = item.keywords.slice(0, 100).map(keyword => {
                    return `${keyword[0]} (${keyword[1]})`;
                }).join(', ');
                const keywordsText = document.createElement('p'); // Create the keywords text
                keywordsText.className = 'card-text';
                keywordsText.textContent = formattedKeywords;

                keywordsCardBody.appendChild(keywordsCardTitle); // Append title to card body
                keywordsCardBody.appendChild(keywordsText); // Append keywords text to card body
                keywordsCard.appendChild(keywordsCardBody); // Append card body to card
                resultItem.appendChild(keywordsCard); // Append card to result item


                // Publications, h-index, total citations
                const statsCard = document.createElement('div'); // Create a new div for the stats card
                statsCard.className = 'card mt-2'; // Use Bootstrap card and margin-top classes
                const statsCardBody = document.createElement('div'); // Create the card body
                statsCardBody.className = 'card-body';
                const statsRow = document.createElement('div'); // Create a row for publication stats
                statsRow.className = 'row text-center'; // Center-align text for better display

                const pubStats5 = document.createElement('div'); // Create a column for publications in last 5 years
                pubStats5.className = 'col-md-4';
                pubStats5.innerHTML = `
        <div class="label">Last 5 years:</div>
        <div class="number h3">${item.pub_stats[5]}</div>
    `;

                const pubStats10 = document.createElement('div'); // Create a column for publications in last 10 years
                pubStats10.className = 'col-md-4';
                pubStats10.innerHTML = `
        <div class="label">Last 10 years:</div>
        <div class="number h3">${item.pub_stats[10]}</div>
    `;

                const hIndex = document.createElement('div'); // Create a column for h-index
                hIndex.className = 'col-md-4';
                hIndex.innerHTML = `
        <div class="label">H-index:</div>
        <div class="number h3">${item.h_index}</div>
    `;

                statsRow.appendChild(pubStats5);
                statsRow.appendChild(pubStats10);
                statsRow.appendChild(hIndex);

                statsCardBody.appendChild(statsRow); // Append publication stats row to card body
                statsCard.appendChild(statsCardBody); // Append card body to card
                resultItem.appendChild(statsCard); // Append card to result item

                resultsContainer.appendChild(resultItem);

                // Fetch additional data for each person
                fetchAdditionalData(formData.t, formData.ab, item.person_id, index);
                fetchPubData(item.person_id, index);
            });
            addPaginationButtons();
          //scroll into view
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
                    ${explanation.title}. 
                    <strong>${toTitleCase(explanation.journal_title)}</strong>.

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
