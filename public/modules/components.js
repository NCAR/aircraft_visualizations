
// Dynamically load the navbar
fetch('navbar.html')
.then(response => {
    if (!response.ok) {
        throw new Error('Failed to load navbar');
    }
    return response.text();
})
.then(data => {
    document.getElementById('NavBar').innerHTML = data;
})
.catch(error => {
    console.error('Error loading navbar:', error);
});

// Dynamically load the footer
fetch('footer.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load footer');
            }
            return response.text();
        })
        .then(data => {
            document.getElementById('footer').innerHTML = data;
        })
        .catch(error => {
            console.error('Error loading footer:', error);
        });
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.grid > div');
    let draggedCard = null;

    cards.forEach(card => {
        card.setAttribute('draggable', true);

        card.addEventListener('dragstart', (e) => {
            draggedCard = card;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', card.innerHTML);
            card.classList.add('opacity-50');
        });

        card.addEventListener('dragend', (e) => {
            draggedCard.classList.remove('opacity-50');
            draggedCard = null;
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        card.addEventListener('dragenter', (e) => {
            if (card !== draggedCard) {
                card.classList.add('bg-gray-100');
            }
        });

        card.addEventListener('dragleave', (e) => {
            card.classList.remove('bg-gray-100');
        });

        card.addEventListener('drop', (e) => {
            if (card !== draggedCard) {
                card.classList.remove('bg-gray-100');
                const draggedIndex = Array.from(card.parentElement.children).indexOf(draggedCard);
                const dropIndex = Array.from(card.parentElement.children).indexOf(card);

                // Handle charts div spanning multiple cells
                if (draggedCard.id === 'charts-card') {
                    handleChartsDrag(card);
                } else if (card.id === 'charts-card') {
                    handleChartsDrop(draggedCard);
                } else {
                    // Standard drag and drop for other cards
                    if (draggedIndex < dropIndex) {
                        card.parentElement.insertBefore(draggedCard, card.nextSibling);
                    } else {
                        card.parentElement.insertBefore(draggedCard, card);
                    }
                }
            }
        });
    });

    function handleChartsDrag(targetCard) {
        const grid = targetCard.parentElement;
        const draggedIndex = Array.from(grid.children).indexOf(draggedCard);
        const dropIndex = Array.from(grid.children).indexOf(targetCard);
        
        if (draggedIndex < dropIndex) {
            grid.insertBefore(draggedCard, targetCard.nextSibling);
        } else {
            grid.insertBefore(draggedCard, targetCard);
        }
    }
    
    function handleChartsDrop(draggedCard) {
        const grid = draggedCard.parentElement;
        const draggedIndex = Array.from(grid.children).indexOf(draggedCard);
        const dropIndex = Array.from(grid.children).indexOf(grid.querySelector('#charts-card'));
        
        if (draggedIndex < dropIndex) {
            grid.insertBefore(draggedCard, grid.querySelector('#charts-card').nextSibling);
        } else {
            grid.insertBefore(draggedCard, grid.querySelector('#charts-card'));
        }
    }
});