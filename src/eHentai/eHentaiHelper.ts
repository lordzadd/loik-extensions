import {
    MangaTile,
    RequestManager,
    SourceStateManager
} from 'paperback-extensions-common'

import { parseTitle } from './eHentaiParser'
//import * as cheerio from 'cheerio';

import { CheerioAPI } from 'cheerio';

export async function getGalleryData(ids: string[], requestManager: RequestManager): Promise<any> {
    const request = createRequestObject({
        url: 'https://api.e-hentai.org/api.php',
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        data: {
            'method': 'gdata',
            'gidlist': ids.map(id => id.split('/')),
            'namespace': 1
        }
    })

    const data = await requestManager.schedule(request, 1)
    const json = (typeof data.data == 'string') ? JSON.parse(data.data.replaceAll(/[\r\n]+/g, ' ')) : data.data
    return json.gmetadata
}

export async function getSearchData(query: string | undefined, page: number, categories: number, requestManager: RequestManager, cheerio: CheerioAPI, stateManager: SourceStateManager): Promise<MangaTile[]> {
    if (query != undefined && query.length != 0 && query.split(' ').filter(q => !q.startsWith('-')).length != 0 && await stateManager.retrieve('extraSearchArgs')) query += ` ${await stateManager.retrieve('extraSearchArgs')}`
    const request = createRequestObject({
        url: `https://e-hentai.org/?f_search=${encodeURIComponent(query ?? '')}&range=${calculateRange(page)}`,
        method: 'GET'
    })
    function calculateRange(pageNumber: number) {
        const itemsPerPage = 25; // Each page has 25 items
        // Calculate the index of the first item on the requested page
        // Page 1 starts at index 0, Page 2 starts at index 25, etc.
        return (pageNumber - 1) * itemsPerPage;
    }
    const data = await requestManager.schedule(request, 1)
    const $ = cheerio.load(data.data)

    const searchResults = $('td.glname').toArray()
    const mangaIds = []
    for (const manga of searchResults) {
        const splitURL = ($('a', manga).attr('href') ?? '/////').split('/')
        mangaIds.push(`${splitURL[4]}/${splitURL[5]}`)
    }

    const json = mangaIds.length != 0 ? await getGalleryData(mangaIds, requestManager) : []
    const results = []

    for (const entry of json) {
        results.push(createMangaTile({
            id: `${entry.gid}/${entry.token}`,
            title: createIconText({ text: parseTitle(entry.title) }),
            image: entry.thumb
        }))
    }

    if ($('div.ptt').last().hasClass('ptdd')) results.push(createMangaTile({
        id: 'stopSearch',
        title: createIconText({ text: '' }),
        image: ''
    }))

    return results
}