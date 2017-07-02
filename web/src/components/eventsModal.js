// @flow
import React from 'react'
import {
    Dialog, FlatButton, TextField, Toggle,
} from 'material-ui'

import { EventsTable } from './'

const customContentStyle = {
    width: '98%',
    maxWidth: 'none',
}

export default class EventsModal extends React.Component {
    state = {
        currentLimit: 100,
        open: false,
        titleFilterText: '',
        participantFilterText: '',
        foodFilter: false,
        onlyFavs: false,
        orgFilterText: '',
        descFilterText: '',
    }

    handleOpen = () => {
        this.setState({open: true})
    }

    handleClose = () => {
        const { withOutButton, onCloseCallback } = this.props
        if (!withOutButton) {
            this.setState({open: false})
        }

        if (onCloseCallback) onCloseCallback()
    }

    props: {
        events: Array<AlmedEvent>,
        choosenEvent?: AlmedEvent,
        buttonStyle?: Object,
        withOutButton?: boolean,
        onCloseCallback?: () => void
    }

    render() {
        const { events, buttonStyle, withOutButton } = this.props
        const { open, titleFilterText, descFilterText, currentLimit,
            orgFilterText, foodFilter, onlyFavs } = this.state
        const actions = [
            <FlatButton
                label="Cancel"
                primary={true}
                onTouchTap={this.handleClose}
            />,
        ]
        let sortedEvents = events
        const filter = (prop: string, filterText: string) => {
            if (!filterText) {
                return
            }
            sortedEvents = sortedEvents.filter((event: AlmedEvent) => {
                if (!event[prop]) {
                    return false
                }
                return filterText.toLowerCase() !== '' && event[prop].toLowerCase().indexOf(filterText) !== -1
            })
        }
        filter('title', titleFilterText)
        filter('organiser', orgFilterText)
        filter('description', descFilterText)

        if (foodFilter) {
            sortedEvents = sortedEvents.filter(event => event.food)
        }

        return (
            <div style={{ marginRight: '1em' }}>
                {!withOutButton && <FlatButton label="Seminars" onTouchTap={this.handleOpen} labelStyle={buttonStyle} />}
                <Dialog
                    title={`Seminars, showing ${currentLimit < sortedEvents.length ? `${currentLimit} of ${sortedEvents.length}` : sortedEvents.length }`}
                    actions={actions}
                    modal={false}
                    open={withOutButton ? !!events.length : open}
                    autoScrollBodyContent={true}
                    onRequestClose={this.handleClose}
                    contentStyle={customContentStyle}
                >
                    <div
                        style={{ display: 'flex', justifyContent: 'spaceBetween'}}
                    >
                        <TextField
                            hintText="Filter title"
                            onChange={(e, text) => this.setState({ titleFilterText: text })}
                        />
                        <TextField
                            hintText="Filter org"
                            onChange={(e, text) => this.setState({ orgFilterText: text })}
                        />
                        <TextField
                            hintText="Filter description"
                            onChange={(e, text) => this.setState({ descFilterText: text })}
                        />
                        <Toggle
                            style={{ width: 20 }}
                            label="Food"
                            onToggle={(e, value) => this.setState({ foodFilter: value })}
                        />
                        <Toggle
                            style={{ width: 20 }}
                            label="Only favs"
                            onToggle={(e, value) => this.setState({ onlyFavs: value })}
                        />
                    </div>
                    <EventsTable events={sortedEvents} onlyFavs={onlyFavs} onLimitChange={(newLimit) => this.setState({ currentLimit: newLimit })} />
                </Dialog>
            </div>
        );
    }
}