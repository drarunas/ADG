// MSDetails.js    

function getDetails() {
    const msDetailsRow = document.querySelector("#ms_details_row_author_information");
    if (!msDetailsRow) {
        console.error("The table row with author information was not found.");
        return;
    }
    const table = msDetailsRow.closest("table"); // Find the closest parent table

    // Function to find sibling TD text based on TH text content
    const findDataByText = (headerText) => {
        const th = Array.from(table.querySelectorAll("th")).find(th =>
            th.textContent.includes(headerText)
        );
        return th ? th.nextElementSibling.textContent : "Not found";
    };

    // Utility function to clean text
    const cleanText = (text) => {
        // Remove honorifics and content within parentheses
        let cleanedText = text
            .replace(/\b(Dr|Mr|Ms|Mrs|Miss|Professor)\.?\s+/gi, "")
            .replace(/\(.*?\)/g, "")
            .trim();
        // Additional cleaning for extra spaces within names
        cleanedText = cleanedText.replace(/\s{2,}/g, " ");
        return cleanedText;
    };

    // Function to get names and links by header text
    const getNamesAndLinksByText = (table, headerText) => {
        // Find the row that contains the headerText
        const row = Array.from(table.querySelectorAll("tr")).find(row =>
            Array.from(row.querySelectorAll("th")).some(th => th.textContent.includes(headerText))
        );

        // If the row is found
        if (row) {
            // Find the target cell (td) that contains the values
            const td = row.querySelector("td");
            if (td) {
                const namesAndLinks = [];
                
                // Iterate through the link elements within the td
                td.querySelectorAll("a").forEach(link => {
                    const name = cleanText(link.textContent.trim());
                    const href = link.href;
                    namesAndLinks.push({ name, link: href });
                });
                
                return namesAndLinks;
            } else {
                console.warn("Value cell not found for header:", headerText);
                return [];
            }
        }
        
        console.warn("Header not found:", headerText);
        return [];
    };

    let contributingAuthors = getNamesAndLinksByText(table, "Contributing Author");
    let correspondingAuthors = getNamesAndLinksByText(table, "Corresponding Author");

    const allAuthors = [...correspondingAuthors, ...contributingAuthors];
    return {
        title: findDataByText("Title"),
        abstract: findDataByText("Abstract"),
        authors: allAuthors
    };
}

$(document).ready(function () {

    const details = getDetails();
    // Return early if details are empty
    if (!details || !details.title || !details.abstract || details.authors.length === 0) {
        console.warn("Details are incomplete or empty.");
        return;
    }

    // Create the overlay div
    const overlay = document.createElement('div');
    overlay.id = 'details-overlay';
    overlay.className = 'details-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.background = 'rgba(255, 255, 255, 0.9)';
    overlay.style.padding = '10px';
    overlay.style.border = '1px solid #ccc';
    overlay.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.1)';
    overlay.style.zIndex = '1000';
    overlay.style.overflowY = 'auto';
    overlay.style.maxHeight = '100vh';

    overlay.style.display = 'none';

    // // Add the title div
    // const titleDiv = document.createElement('div');
    // titleDiv.id = 'title';
    // const title = document.createElement('h5');
    // title.textContent = details.title;
    // titleDiv.appendChild(title);
    // overlay.appendChild(titleDiv);

    // // Add the abstract div
    // const abstractDiv = document.createElement('div');
    // abstractDiv.id = 'abstract';
    // const abstract = document.createElement('p');
    // abstract.textContent = details.abstract;
    // abstractDiv.appendChild(abstract);
    // overlay.appendChild(abstractDiv);

    // Add the authors div
    const authorsDiv = document.createElement('div');
    authorsDiv.id = 'authors';
    const authorsList = document.createElement('ul');
    authorsList.className = 'list-unstyled';
    details.authors.forEach(author => {
        const listItem = document.createElement('li');

        // Create name element
        const nameDiv = document.createElement('div');
        nameDiv.id = 'name';
        const authorLink = document.createElement('a');
        authorLink.href = author.link;
        authorLink.textContent = author.name;
        nameDiv.appendChild(authorLink);
        listItem.appendChild(nameDiv);

        // Create email element
        const emailDiv = document.createElement('div');
        emailDiv.id = 'email';
        emailDiv.textContent = 'waiting';
        listItem.appendChild(emailDiv);

        // Fetch email and append to emailDiv
        eJPGetEmail(author.link).then(email => {
            if (email) {
                emailDiv.textContent = email;
            } else {
                emailDiv.textContent = 'No email found';
            }
        });

        authorsList.appendChild(listItem);
    });
    authorsDiv.appendChild(authorsList);
    overlay.appendChild(authorsDiv);

    // Append the overlay to the body
    document.body.appendChild(overlay);

});

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
            console.log(email)
            return email;
        }
        return null; // Return null if no email found
    } catch (error) {
        console.error("Error opening page or parsing email:", error);
        return null; // Return null in case of error
    }
}
